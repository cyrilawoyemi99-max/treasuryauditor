import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

const CANONICAL = process.env.CANONICAL_ADDR
  || '0x26B7805Dd8aEc26DA55fc8e0c659cf6822b740Be';

const SUBDOMAINS = (process.env.SUBDOMAINS || [
  'pool.owockibot.xyz',
  'jar.owockibot.xyz',
  'staking.owockibot.xyz',
  'vote.owockibot.xyz',
  'qf.owockibot.xyz',
  'rfps.owockibot.xyz',
  'curves.owockibot.xyz',
  'lotto.owockibot.xyz',
  'ranked.owockibot.xyz',
  'stream.owockibot.xyz',
  'circles.owockibot.xyz',
  'mutual.owockibot.xyz',
  'grants.owockibot.xyz',
  'dominant.owockibot.xyz',
  'assurance.owockibot.xyz',
  'ubi.owockibot.xyz',
  'honour.owockibot.xyz',
  'ephemeral.owockibot.xyz',
  'autopgf.owockibot.xyz',
  'ships.owockibot.xyz',
  'attestations.owockibot.xyz',
  'prediction.owockibot.xyz',
  'futarchy.owockibot.xyz',
  'registry.owockibot.xyz',
  'stats.owockibot.xyz',
].join(',')).split(',').map(s => s.trim()).filter(Boolean);

const ETH_ADDR_RE = /0x[a-fA-F0-9]{40}/g;

async function extractTreasuryAddress(subdomain) {
  const url = `https://${subdomain}`;
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      timeout: 10_000,
      headers: { 'User-Agent': 'owockibot-treasury-auditor/1.0' }
    });
    httpStatus = res.status;
    if (!res.ok) return { httpStatus, foundAddress: null, source: null };
    const html = await res.text();
    const $ = cheerio.load(html);
    const footerText = $('footer, [class*="footer"], [id*="footer"]').text();
    const footerMatches = footerText.match(ETH_ADDR_RE) || [];
    const dataAttrs = [];
    $('[data-treasury], [data-address], [aria-label*="treasury"]').each((_, el) => {
      const v = $(el).attr('data-treasury') || $(el).attr('data-address') || $(el).text();
      const m = v.match(ETH_ADDR_RE);
      if (m) dataAttrs.push(...m);
    });
    const classMatches = [];
    $('[class*="treasury"], [class*="address"]').each((_, el) => {
      const m = $(el).text().match(ETH_ADDR_RE);
      if (m) classMatches.push(...m);
    });
    const addr = footerMatches[0] || dataAttrs[0] || classMatches[0] || null;
    return {
      httpStatus,
      foundAddress: addr,
      source: footerMatches[0] ? 'footer' : dataAttrs[0] ? 'data-attr' : classMatches[0] ? 'css-class' : null,
    };
  } catch (err) {
    return { httpStatus, foundAddress: null, source: null, error: err.message };
  }
}

function statusOf(foundAddress) {
  if (!foundAddress) return 'not_found';
  return foundAddress.toLowerCase() === CANONICAL.toLowerCase() ? 'match' : 'mismatch';
}

async function runAudit() {
  console.error(`[audit] canonical: ${CANONICAL}`);
  console.error(`[audit] checking ${SUBDOMAINS.length} subdomains...`);
  const results = await Promise.all(
    SUBDOMAINS.map(async (subdomain) => {
      console.error(`[audit] → ${subdomain}`);
      const { httpStatus, foundAddress, source, error } = await extractTreasuryAddress(subdomain);
      const status = httpStatus === 0 ? 'unreachable'
                   : httpStatus >= 400 ? 'error'
                   : statusOf(foundAddress);
      return { subdomain, httpStatus, foundAddress, source, status, error };
    })
  );
  const summary = {
    total:      results.length,
    matches:    results.filter(r => r.status === 'match').length,
    mismatches: results.filter(r => r.status === 'mismatch').length,
    errors:     results.filter(r => ['error','unreachable','not_found'].includes(r.status)).length,
  };
  const report = { canonical: CANONICAL, auditedAt: new Date().toISOString(), summary, results };
  writeFileSync('audit-report.json', JSON.stringify(report, null, 2));
  const W = 60;
  console.log('\n' + '═'.repeat(W));
  console.log('  owockibot Treasury Address Audit Report');
  console.log('  ' + new Date().toUTCString());
  console.log('═'.repeat(W));
  console.log(`  Canonical: ${CANONICAL}`);
  console.log('─'.repeat(W));
  console.log(`  ${'SUBDOMAIN'.padEnd(30)} STATUS       ADDRESS`);
  console.log('─'.repeat(W));
  for (const r of results) {
    const icon = r.status === 'match' ? '✓' : r.status === 'mismatch' ? '✗' : '⚠';
    const addr = r.foundAddress ? r.foundAddress.slice(0,8) + '…' + r.foundAddress.slice(-6) : r.status;
    console.log(`  ${icon} ${r.subdomain.padEnd(28)} ${r.status.padEnd(12)} ${addr}`);
  }
  console.log('─'.repeat(W));
  console.log(`  Total: ${summary.total}  ✓ ${summary.matches}  ✗ ${summary.mismatches}  ⚠ ${summary.errors}`);
  console.log('═'.repeat(W) + '\n');
  if (summary.mismatches > 0) {
    console.error(`[audit] FAIL: ${summary.mismatches} mismatch(es) found.`);
    process.exit(1);
  }
  console.error('[audit] PASS: all addresses match canonical.');
}

runAudit().catch(err => { console.error(err); process.exit(1); });
