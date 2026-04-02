#!/usr/bin/env node

/**
 * 验证并修复合约数据
 * 检查并清理所有非Alpha币种的合约数据
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ 错误：未提供数据库连接URL');
  console.error('使用方法：');
  console.error('  export DATABASE_URL="postgresql://..." && node verify-and-fix-futures.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
});

async function verifyAndFix() {
  const client = await pool.connect();

  try {
    console.log('🔍 正在验证合约数据...\n');

    // 1. 检查所有有合约数据的币种
    const futuresQuery = `
      SELECT
        c.symbol,
        c.name,
        c.alpha_id,
        c.alpha_listing_time,
        fd.is_listed,
        fd.listing_time as futures_listing_time
      FROM coins c
      INNER JOIN futures_data fd ON fd.coin_id = c.id
      WHERE fd.is_listed = true
      ORDER BY c.symbol;
    `;

    const futuresResult = await client.query(futuresQuery);

    console.log(`📊 数据库统计：`);
    console.log(`   有合约的币种总数: ${futuresResult.rows.length}\n`);

    // 2. 分类统计
    const alphaCoins = futuresResult.rows.filter(row => row.alpha_id || row.alpha_listing_time);
    const nonAlphaCoins = futuresResult.rows.filter(row => !row.alpha_id && !row.alpha_listing_time);

    console.log(`✅ 上过Alpha的合约币种: ${alphaCoins.length}`);
    console.log(`❌ 未上过Alpha的合约币种: ${nonAlphaCoins.length}\n`);

    if (nonAlphaCoins.length > 0) {
      console.log('❌ 发现非Alpha币种（不应该出现在合约列表中）：\n');

      // 显示前20个
      const displayCoins = nonAlphaCoins.slice(0, 20);
      displayCoins.forEach(coin => {
        console.log(`   - ${coin.symbol.padEnd(10)} | ${coin.name || 'N/A'}`);
      });

      if (nonAlphaCoins.length > 20) {
        console.log(`   ... 还有 ${nonAlphaCoins.length - 20} 个\n`);
      } else {
        console.log('');
      }

      // 询问是否清理
      console.log('🗑️  开始清理非Alpha币种的合约数据...\n');

      await client.query('BEGIN');

      // 删除非Alpha币种的合约数据
      const deleteQuery = `
        DELETE FROM futures_data
        WHERE coin_id IN (
          SELECT id FROM coins
          WHERE (alpha_id IS NULL OR alpha_id = '')
            AND (alpha_listing_time IS NULL OR alpha_listing_time = '')
        )
      `;

      const deleteResult = await client.query(deleteQuery);
      console.log(`   删除了 ${deleteResult.rowCount} 条非Alpha币种的合约数据`);

      // 删除没有alpha_id的币种（如果它们没有其他用途）
      const deleteCoinsQuery = `
        DELETE FROM coins
        WHERE (alpha_id IS NULL OR alpha_id = '')
          AND (alpha_listing_time IS NULL OR alpha_listing_time = '')
      `;

      const deleteCoinsResult = await client.query(deleteCoinsQuery);
      console.log(`   删除了 ${deleteCoinsResult.rowCount} 个非Alpha币种\n`);

      await client.query('COMMIT');

      console.log('✅ 清理完成！\n');
    } else {
      console.log('✅ 没有发现非Alpha币种的合约数据，数据库是干净的！\n');
    }

    // 3. 显示清理后的统计
    const afterQuery = `
      SELECT
        COUNT(DISTINCT c.id) as total_futures_coins,
        COUNT(DISTINCT CASE WHEN c.alpha_id IS NOT NULL THEN c.id END) as alpha_futures_coins
      FROM coins c
      INNER JOIN futures_data fd ON fd.coin_id = c.id
      WHERE fd.is_listed = true;
    `;

    const afterResult = await client.query(afterQuery);
    const afterStats = afterResult.rows[0];

    console.log('📊 清理后的统计：');
    console.log(`   有合约的Alpha币种: ${afterStats.alpha_futures_coins}`);
    console.log(`   有合约的非Alpha币种: ${afterStats.total_futures_coins - afterStats.alpha_futures_coins}\n`);

    // 4. 验证视图
    console.log('🔍 验证数据库视图...\n');

    const viewQuery = `
      SELECT COUNT(*) as count
      FROM v_coins_latest
      WHERE futures_listed = true;
    `;

    const viewResult = await client.query(viewQuery);
    console.log(`   视图中有合约的币种数: ${viewResult.rows[0].count}`);
    console.log(`   （应该等于 ${afterStats.alpha_futures_coins}）\n`);

    if (parseInt(viewResult.rows[0].count) !== parseInt(afterStats.alpha_futures_coins)) {
      console.log('⚠️  警告：视图数据与实际数据不一致！');
      console.log('   可能需要更新视图定义，确保包含 alpha_id 筛选条件\n');
    } else {
      console.log('✅ 视图验证通过！\n');
    }

    // 5. 显示一些Alpha合约币种的示例
    console.log('📋 Alpha合约币种示例（最近上线的5个）：\n');

    const exampleQuery = `
      SELECT
        c.symbol,
        c.name,
        c.alpha_id,
        fd.listing_time as futures_listing_time
      FROM coins c
      INNER JOIN futures_data fd ON fd.coin_id = c.id
      WHERE fd.is_listed = true
        AND c.alpha_id IS NOT NULL
      ORDER BY fd.listing_time DESC
      LIMIT 5;
    `;

    const exampleResult = await client.query(exampleQuery);
    exampleResult.rows.forEach(coin => {
      const date = new Date(coin.futures_listing_time).toLocaleDateString('zh-CN');
      console.log(`   ✓ ${coin.symbol.padEnd(10)} | ${coin.name.padEnd(20)} | ${coin.alpha_id} | ${date}`);
    });

    console.log('\n✅ 验证和修复完成！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 操作失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAndFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
