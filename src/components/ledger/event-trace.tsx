'use client';
import { ProofRequest } from '@/components/proof/proof-request';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEventTrace } from '@/hooks/useLedger';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/lib/amount';
import type { AssetId, EventType } from '@/types/ledger';

const names: Record<EventType, string> = { BUY: '매수', SELL: '매도', TRANSFER: '이체', REWARD: '보상', AIRDROP: '에어드롭', SWAP: '스왑', CORRECTION: '정정', FEE: '네트워크 수수료' };
const reasons = { missing_history: '출처 이력 부족', missing_account: '계정 정보 없음', prior_deficit: '이전 부족분에 충당' };
const assetName = (asset: AssetId) => [asset.symbol, asset.chain_id, asset.contract].filter(Boolean).join(' · ');

export function EventTrace({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [eventId]);
  const [depth, setDepth] = useState(32);
  const [selected, setSelected] = useState(eventId);
  const [zoom, setZoom] = useState(100);
  const trace = useEventTrace(eventId, { max_depth: depth, max_nodes: 100, max_edges: 500 });
  const data = trace.data;
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number; level: number }>();
    const rows = new Map<number, number>();
    const parents = new Map<string, string[]>();
    for (const edge of data?.edges ?? []) parents.set(edge.to_event_id, [...(parents.get(edge.to_event_id) ?? []), edge.from_event_id]);
    for (const node of data?.path ?? []) {
      const level = Math.max(0, ...(parents.get(node.event_id) ?? []).map(id => (result.get(id)?.level ?? -1) + 1));
      const row = rows.get(level) ?? 0;
      rows.set(level, row + 1);
      result.set(node.event_id, { x: 24 + level * 240, y: 24 + row * 100, level });
    }
    return result;
  }, [data]);
  const width = Math.max(500, ...Array.from(positions.values(), p => p.x + 220));
  const height = Math.max(160, ...Array.from(positions.values(), p => p.y + 100));
  const node = data?.path.find(n => n.event_id === selected) ?? data?.path.find(n => n.event_id === eventId);
  const related = data?.edges.filter(e => e.from_event_id === node?.event_id || e.to_event_id === node?.event_id) ?? [];
  const index = new Map(data?.path.map((n, i) => [n.event_id, i + 1]));

  return <section ref={panel} className="scroll-mt-24 mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4" aria-label="거래 출처 추적">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">거래 출처 추적</h2><Button variant="outline" size="sm" onClick={onClose}>추적 닫기</Button></div>
    <p className="text-sm text-gray-600">계정별로 먼저 들어온 수량부터 연결합니다. 정정이 반영된 원장 내 흐름이며 세금 취득원가나 외부 지갑의 실제 출처를 확정하지 않습니다.</p>
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label>추적 깊이 <select className="rounded border p-2" value={depth} onChange={e => setDepth(Number(e.target.value))}>{[1, 2, 8, 32, 100, 1000].map(value => <option key={value} value={value}>{value}단계</option>)}</select></label>
      <label>그래프 확대 <input className="align-middle" type="range" min={50} max={150} step={25} value={zoom} onChange={e => setZoom(Number(e.target.value))} /> {zoom}%</label>
      <Button variant="outline" size="sm" disabled={trace.isFetching} onClick={() => trace.refetch()}>추적 새로고침</Button>
    </div>
    <p className="text-xs text-gray-500">갈색 연결은 수수료입니다. 한 번에 최대 100개 거래와 500개 연결을 조회합니다. 범위를 초과하면 추적 깊이를 줄여주세요.</p>
    {trace.isLoading && <p role="status">출처를 확인하고 있습니다…</p>}
    {trace.isError && <p role="alert" className="text-sm text-red-700">출처를 조회할 수 없습니다. {trace.error.message}</p>}
    {data && <>
      <p role="status" className={data.complete ? 'text-sm text-green-800' : 'text-sm text-amber-800'}>{data.complete ? '조회 범위의 연결이 모두 확인되었습니다.' : '출처 확인이 일부 남아 있습니다.'} 거래 {data.path.length}개 · 연결 {data.edges.length}개 · 확인된 시작 거래 {data.origin_event_ids.length}개</p>
      {data.truncated && <p className="text-sm text-amber-800">깊이 제한으로 {data.frontier_event_ids.length}개 거래의 이전 연결이 생략되었습니다. 더 확인하려면 추적 깊이를 늘려주세요.</p>}
      {data.gaps.length > 0 && <ul className="space-y-1 rounded bg-amber-50 p-3 text-sm" aria-label="출처 확인 필요">{data.gaps.map((gap, i) => <li key={i} className="break-all">거래 {index.get(gap.event_id)} · {reasons[gap.reason]}: {formatAmount(gap.amount)} {assetName(gap.asset_id)}{gap.account_id ? ` · 계정 ${gap.account_id}` : ''}</li>)}</ul>}
      {data.path.length === 0 ? <p>표시할 거래가 없습니다.</p> : <>
        <div className="max-h-[420px] overflow-auto rounded border bg-gray-50" tabIndex={0} aria-label="거래 흐름 그래프. 거래를 선택하면 연결 수량을 확인할 수 있습니다.">
          <svg width={width * zoom / 100} height={height * zoom / 100} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="시간 순서의 자산 흐름">
            <defs><marker id={`trace-arrow-${eventId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>
            {data.edges.map((edge, i) => {
              const from = positions.get(edge.from_event_id), to = positions.get(edge.to_event_id);
              const offset = edge.flow_type === 'fee' ? 8 : 0;
              return from && to ? <g key={i}><path d={`M${from.x + 180} ${from.y + 32 + offset} C${from.x + 215} ${from.y + 32 + offset}, ${to.x - 35} ${to.y + 32 + offset}, ${to.x} ${to.y + 32 + offset}`} fill="none" stroke={edge.flow_type === 'fee' ? '#b45309' : '#94a3b8'} strokeWidth={2} markerEnd={`url(#trace-arrow-${eventId})`} /><title>{index.get(edge.from_event_id)} → {index.get(edge.to_event_id)}: {formatAmount(edge.amount)} {assetName(edge.asset_id)}</title></g> : null;
            })}
            {data.path.map((item, i) => {
              const point = positions.get(item.event_id)!;
              return <g key={item.event_id} transform={`translate(${point.x},${point.y})`} role="button" tabIndex={0} aria-label={`거래 ${i + 1} ${names[item.event_type]} ${assetName(item.asset_id)} 선택`} aria-pressed={node?.event_id === item.event_id} onClick={() => setSelected(item.event_id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(item.event_id); } }} className="cursor-pointer outline-offset-2">
                <rect width={180} height={64} rx={8} fill={node?.event_id === item.event_id ? '#e0e7ff' : 'white'} stroke={data.frontier_event_ids.includes(item.event_id) ? '#b45309' : '#94a3b8'} />
                <text x={12} y={25} fontSize={13}>{i + 1}. {names[item.event_type]} · {item.asset_id.symbol.slice(0, 14)}</text>
                <text x={12} y={47} fontSize={11} fill="#475569">{item.timestamp.slice(0, 19).replace('T', ' ')} UTC</text>
              </g>;
            })}
          </svg>
        </div>
        {node && <div className="space-y-2 text-sm" aria-label="선택한 거래 상세">
          <ProofRequest kind="LEDGER_RECORD" reference={node.event_id} />
          <h3 className="font-semibold">선택 거래 {index.get(node.event_id)} · {names[node.event_type]}</h3>
          <p className="break-all">{formatAmount(node.amount)} {assetName(node.asset_id)} · {node.timestamp} · 분류 버전 {node.classification_revision ?? 0}</p>
          <p className="break-all text-gray-600">거래 {node.event_id} · 출처 {node.source || '미지정'}</p>
          <p className="break-all text-gray-600">출발 계정 {node.from_account_id || '미지정'} → 도착 계정 {node.to_account_id || '미지정'}</p>
          {node.counter_amount && node.counter_asset_id && <p className="break-all">상대 자산 {formatAmount(node.counter_amount)} {assetName(node.counter_asset_id)}</p>}
          {node.fee_amount && node.fee_asset_id && <p className="break-all">수수료 {formatAmount(node.fee_amount)} {assetName(node.fee_asset_id)}</p>}
          {data.origin_event_ids.includes(node.event_id) && <p>기록된 범위의 시작 거래입니다.</p>}
          {related.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="py-2 text-left font-medium">선택 거래의 배분 수량</caption><thead><tr><th className="p-2">연결</th><th className="p-2">구분</th><th className="p-2">수량 · 자산</th></tr></thead><tbody>{related.map((edge, i) => <tr key={i} className="border-t"><td className="p-2">{index.get(edge.from_event_id)} → {index.get(edge.to_event_id)}</td><td className="p-2">{edge.flow_type === 'fee' ? '수수료' : edge.flow_type === 'transfer' ? '이체' : '사용'}</td><td className="break-all p-2 font-mono">{formatAmount(edge.amount)} {assetName(edge.asset_id)}</td></tr>)}</tbody></table></div>}
        </div>}
      </>}
    </>}
  </section>;
}
