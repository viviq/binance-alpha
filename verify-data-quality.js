#!/usr/bin/env node

/**
 * 数据质量验证脚本
 * 检查并报告数据库中的数据质量问题
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ 错误：未提供数据库连接URL');
  console.error('使用方法：');
  console.error('  export DATABASE_URL="postgresql://..." && node verify-data-quality.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
});

async function verifyDataQuality() {
  const client = await pool.connect();

  try {
    console.log('🔍 开始验证数据质量...\n');

    // 1. 检查视图中的数据总数
    const totalQuery = `SELECT COUNT(*) as count FROM v_coins_latest;`;
    const totalResult = await client.query(totalQuery);
    console.log(`📊 总币种数: ${totalResult.rows[0].count}\n`);

    // 2. 检查没有价格数据的币种
    const noPriceQuery = `
      SELECT symbol, name, alpha_id, current_price, market_cap
      FROM v_coins_latest
      WHERE current_price IS NULL OR current_price <= 0
      ORDER BY alpha_listing_time DESC;
    `;
    const noPriceResult = await client.query(noPriceQuery);

    if (noPriceResult.rows.length > 0) {
      console.log(`❌ 发现 ${noPriceResult.rows.length} 个没有价格数据的币种：\n`);
      noPriceResult.rows.slice(0, 10).forEach(coin => {
        console.log(`   - ${coin.symbol.padEnd(10)} | ${(coin.name || 'N/A').padEnd(20)} | 价格: ${coin.current_price || 'NULL'}`);
      });
      if (noPriceResult.rows.length > 10) {
        console.log(`   ... 还有 ${noPriceResult.rows.length - 10} 个\n`);
      } else {
        console.log('');
      }
    } else {
      console.log('✅ 所有币种都有价格数据\n');
    }

    // 3. 检查没有市值数据的币种
    const noMarketCapQuery = `
      SELECT symbol, name, current_price, market_cap, circulating_supply
      FROM v_coins_latest
      WHERE current_price > 0 AND (market_cap IS NULL OR market_cap <= 0)
      ORDER BY alpha_listing_time DESC;
    `;
    const noMarketCapResult = await client.query(noMarketCapQuery);

    if (noMarketCapResult.rows.length > 0) {
      console.log(`⚠️  发现 ${noMarketCapResult.rows.length} 个有价格但没有市值的币种：\n`);
      noMarketCapResult.rows.slice(0, 10).forEach(coin => {
        console.log(`   - ${coin.symbol.padEnd(10)} | 价格: $${coin.current_price?.toFixed(6) || 'N/A'} | 市值: ${coin.market_cap || 'NULL'}`);
      });
      if (noMarketCapResult.rows.length > 10) {
        console.log(`   ... 还有 ${noMarketCapResult.rows.length - 10} 个\n`);
      } else {
        console.log('');
      }
    } else {
      console.log('✅ 所有有价格的币种都有市值数据\n');
    }

    // 4. 检查没有 FDV 数据的币种
    const noFdvQuery = `
      SELECT symbol, name, current_price, total_supply, fdv
      FROM v_coins_latest
      WHERE current_price > 0 AND (fdv IS NULL OR fdv <= 0)
      ORDER BY alpha_listing_time DESC;
    `;
    const noFdvResult = await client.query(noFdvQuery);

    if (noFdvResult.rows.length > 0) {
      console.log(`⚠️  发现 ${noFdvResult.rows.length} 个没有 FDV 数据的币种：\n`);
      noFdvResult.rows.slice(0, 10).forEach(coin => {
        console.log(`   - ${coin.symbol.padEnd(10)} | 总供应: ${coin.total_supply || 'NULL'} | FDV: ${coin.fdv || 'NULL'}`);
      });
      if (noFdvResult.rows.length > 10) {
        console.log(`   ... 还有 ${noFdvResult.rows.length - 10} 个\n`);
      } else {
        console.log('');
      }
    } else {
      console.log('✅ 所有币种都有 FDV 数据\n');
    }

    // 5. 检查没有 alpha_id 的币种（不应该存在）
    const noAlphaIdQuery = `
      SELECT symbol, name, alpha_id
      FROM coins
      WHERE is_active = true AND (alpha_id IS NULL OR alpha_id = '')
      ORDER BY created_at DESC;
    `;
    const noAlphaIdResult = await client.query(noAlphaIdQuery);

    if (noAlphaIdResult.rows.length > 0) {
      console.log(`❌ 发现 ${noAlphaIdResult.rows.length} 个没有 alpha_id 的币种（应该被视图过滤）：\n`);
      noAlphaIdResult.rows.slice(0, 10).forEach(coin => {
        console.log(`   - ${coin.symbol.padEnd(10)} | ${(coin.name || 'N/A').padEnd(20)} | alpha_id: ${coin.alpha_id || 'NULL'}`);
      });
      if (noAlphaIdResult.rows.length > 10) {
        console.log(`   ... 还有 ${noAlphaIdResult.rows.length - 10} 个\n`);
      } else {
        console.log('');
      }
      console.log('   ⚠️  这些币种不应该存在，建议运行清理脚本\n');
    } else {
      console.log('✅ 所有币种都有 alpha_id\n');
    }

    // 6. 数据完整性统计
    console.log('📊 数据完整性统计：\n');

    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(current_price) FILTER (WHERE current_price > 0) as with_price,
        COUNT(market_cap) FILTER (WHERE market_cap > 0) as with_market_cap,
        COUNT(fdv) FILTER (WHERE fdv > 0) as with_fdv,
        COUNT(total_supply) FILTER (WHERE total_supply > 0) as with_total_supply,
        COUNT(futures_listed) FILTER (WHERE futures_listed = true) as with_futures
      FROM v_coins_latest;
    `;

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    console.log(`   总币种: ${stats.total}`);
    console.log(`   有价格: ${stats.with_price} (${(stats.with_price / stats.total * 100).toFixed(1)}%)`);
    console.log(`   有市值: ${stats.with_market_cap} (${(stats.with_market_cap / stats.total * 100).toFixed(1)}%)`);
    console.log(`   有FDV: ${stats.with_fdv} (${(stats.with_fdv / stats.total * 100).toFixed(1)}%)`);
    console.log(`   有总供应量: ${stats.with_total_supply} (${(stats.with_total_supply / stats.total * 100).toFixed(1)}%)`);
    console.log(`   已上合约: ${stats.with_futures} (${(stats.with_futures / stats.total * 100).toFixed(1)}%)\n`);

    // 7. 数据新鲜度检查
    console.log('📅 数据新鲜度检查：\n');

    const freshnessQuery = `
      SELECT
        COUNT(*) FILTER (WHERE last_updated >= NOW() - INTERVAL '5 minutes') as updated_5min,
        COUNT(*) FILTER (WHERE last_updated >= NOW() - INTERVAL '1 hour') as updated_1hour,
        COUNT(*) FILTER (WHERE last_updated >= NOW() - INTERVAL '1 day') as updated_1day,
        COUNT(*) FILTER (WHERE last_updated < NOW() - INTERVAL '1 day') as outdated
      FROM v_coins_latest;
    `;

    const freshnessResult = await client.query(freshnessQuery);
    const freshness = freshnessResult.rows[0];

    console.log(`   5分钟内更新: ${freshness.updated_5min}`);
    console.log(`   1小时内更新: ${freshness.updated_1hour}`);
    console.log(`   1天内更新: ${freshness.updated_1day}`);
    console.log(`   超过1天未更新: ${freshness.outdated}\n`);

    if (freshness.outdated > 0) {
      console.log(`   ⚠️  有 ${freshness.outdated} 个币种超过1天未更新\n`);
    }

    console.log('✅ 数据质量验证完成！\n');

    // 8. 建议
    console.log('💡 建议：\n');
    if (noPriceResult.rows.length > 0) {
      console.log('   - 运行数据采集器更新价格数据');
    }
    if (noAlphaIdResult.rows.length > 0) {
      console.log('   - 运行 clean-non-alpha-coins.js 清理非Alpha币种');
    }
    if (freshness.outdated > 0) {
      console.log('   - 检查数据采集器是否正常运行');
    }
    if (noPriceResult.rows.length === 0 && noAlphaIdResult.rows.length === 0 && freshness.outdated === 0) {
      console.log('   - 数据质量良好，无需特殊操作');
    }
    console.log('');

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDataQuality().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
