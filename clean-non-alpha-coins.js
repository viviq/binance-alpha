#!/usr/bin/env node

/**
 * 清理非Alpha币种脚本
 * 删除所有没有alpha_id的币种及其相关数据
 */

const { Pool } = require('pg');

// 从环境变量或命令行参数获取数据库连接
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ 错误：未提供数据库连接URL');
  console.error('使用方法：');
  console.error('  1. 设置环境变量: export DATABASE_URL="postgresql://..."');
  console.error('  2. 或作为参数传递: node clean-non-alpha-coins.js "postgresql://..."');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
});

async function cleanNonAlphaCoins() {
  const client = await pool.connect();

  try {
    console.log('🔍 正在检查数据库中的币种...\n');

    // 统计数据
    const statsQuery = `
      SELECT
        COUNT(*) as total_coins,
        COUNT(CASE WHEN alpha_id IS NOT NULL AND alpha_id != '' THEN 1 END) as alpha_coins,
        COUNT(CASE WHEN alpha_id IS NULL OR alpha_id = '' THEN 1 END) as non_alpha_coins
      FROM coins
      WHERE is_active = true;
    `;

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    console.log('📊 数据库统计：');
    console.log(`   总币种数: ${stats.total_coins}`);
    console.log(`   Alpha币种: ${stats.alpha_coins}`);
    console.log(`   非Alpha币种: ${stats.non_alpha_coins}\n`);

    if (stats.non_alpha_coins === '0') {
      console.log('✅ 没有发现非Alpha币种，数据库已经是干净的！');
      return;
    }

    // 显示将要删除的币种
    const coinsToDeleteQuery = `
      SELECT symbol, name, alpha_listing_time
      FROM coins
      WHERE (alpha_id IS NULL OR alpha_id = '')
      ORDER BY symbol
      LIMIT 20;
    `;

    const coinsToDelete = await client.query(coinsToDeleteQuery);

    console.log('❌ 将要删除的非Alpha币种（前20个）：');
    coinsToDelete.rows.forEach(coin => {
      console.log(`   - ${coin.symbol} (${coin.name})`);
    });

    if (stats.non_alpha_coins > 20) {
      console.log(`   ... 还有 ${stats.non_alpha_coins - 20} 个币种\n`);
    } else {
      console.log('');
    }

    // 执行清理
    console.log('🗑️  开始清理非Alpha币种...');

    await client.query('BEGIN');

    // 删除非Alpha币种（会级联删除相关的价格历史和合约数据）
    const deleteResult = await client.query(`
      DELETE FROM coins
      WHERE alpha_id IS NULL OR alpha_id = ''
    `);

    await client.query('COMMIT');

    console.log(`✅ 成功删除 ${deleteResult.rowCount} 个非Alpha币种及其相关数据\n`);

    // 显示清理后的统计
    const afterStats = await client.query(statsQuery);
    const afterStatsData = afterStats.rows[0];

    console.log('📊 清理后的数据库统计：');
    console.log(`   总币种数: ${afterStatsData.total_coins}`);
    console.log(`   Alpha币种: ${afterStatsData.alpha_coins}`);
    console.log(`   非Alpha币种: ${afterStatsData.non_alpha_coins}\n`);

    console.log('✅ 清理完成！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 清理失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行清理
cleanNonAlphaCoins().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
