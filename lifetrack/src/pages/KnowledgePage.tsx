import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useStore } from '../lib/store'
import { ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react'
import clsx from 'clsx'

interface GNode extends d3.SimulationNodeDatum { id: string; type: string; label: string; weight: number; color: string; data: Record<string, unknown> }
interface GEdge extends d3.SimulationLinkDatum<GNode> { type: string }

const TYPE_COLORS: Record<string, string> = {
  note: '#ea580c', goal: '#8b5cf6', person: '#0891b2',
  tag: '#10b981', category: '#f59e0b', daily: '#e11d48',
}

const EMOTION_COLORS: Record<string, string> = {
  great: '#10b981', good: '#3b82f6', neutral: '#94a3b8', bad: '#f59e0b', terrible: '#ef4444',
}

export default function KnowledgePage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { notes, goals, dailyEntries } = useStore()
  const [selected, setSelected] = useState<GNode | null>(null)
  const [filter, setFilter] = useState<string[]>(['note', 'goal', 'person', 'tag'])
  const [nodeCount, setNodeCount] = useState(0)

  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = []
    const edges: GEdge[] = []
    const seen = new Set<string>()

    const addNode = (n: GNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n) } }

    if (filter.includes('note')) {
      notes.slice(0, 80).forEach(note => {
        addNode({
          id: 'note:' + note.id,
          type: 'note',
          label: note.title || 'Not',
          weight: 1 + Math.min((note.content?.length ?? 0) / 500, 3),
          color: note.emotion ? EMOTION_COLORS[note.emotion] ?? TYPE_COLORS.note : TYPE_COLORS.note,
          data: { ...note } as Record<string, unknown>,
        })

        // Tag edges
        if (filter.includes('tag')) {
          note.tags.forEach(tag => {
            const tagId = 'tag:' + tag
            addNode({ id: tagId, type: 'tag', label: '#' + tag, weight: 0.8, color: TYPE_COLORS.tag, data: { name: tag } })
            edges.push({ source: 'note:' + note.id, target: tagId, type: 'tag' })
          })
        }

        // Person edges
        if (filter.includes('person')) {
          note.persons.forEach(p => {
            const pid = 'person:' + p
            addNode({ id: pid, type: 'person', label: p, weight: 1.2, color: TYPE_COLORS.person, data: { name: p } })
            edges.push({ source: 'note:' + note.id, target: pid, type: 'person' })
          })
        }
      })
    }

    if (filter.includes('goal')) {
      goals.forEach(g => {
        addNode({
          id: 'goal:' + g.id,
          type: 'goal',
          label: g.title,
          weight: 1.5 + g.progress / 50,
          color: TYPE_COLORS.goal,
          data: { ...g } as Record<string, unknown>,
        })
      })
    }

    if (filter.includes('daily')) {
      dailyEntries.slice(0, 30).forEach(d => {
        addNode({
          id: 'daily:' + d.id,
          type: 'daily',
          label: d.date,
          weight: 0.9,
          color: d.emotion ? EMOTION_COLORS[d.emotion] ?? TYPE_COLORS.daily : TYPE_COLORS.daily,
          data: { ...d } as Record<string, unknown>,
        })
        if (filter.includes('person')) {
          d.persons.forEach(p => {
            const pid = 'person:' + p
            if (seen.has(pid)) edges.push({ source: 'daily:' + d.id, target: pid, type: 'person' })
          })
        }
      })
    }

    return { nodes, edges }
  }, [notes, goals, dailyEntries, filter])

  useEffect(() => {
    setNodeCount(nodes.length)
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return

    const container = containerRef.current
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600

    const svg = d3.select(svgRef.current).attr('width', w).attr('height', h)
    svg.selectAll('*').remove()

    // Zoom
    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (e) => g.attr('transform', e.transform))
    svg.call(zoom)

    // Force simulation
    const sim = d3.forceSimulation<GNode>(nodes)
      .force('link', d3.forceLink<GNode, GEdge>(edges).id((d) => d.id).distance(80).strength(0.4))
      .force('charge', d3.forceManyBody<GNode>().strength((d) => -120 - d.weight * 30))
      .force('center', d3.forceCenter<GNode>(w / 2, h / 2))
      .force('collision', d3.forceCollide<GNode>((d) => 14 + d.weight * 4))

    // Edges
    const link = g.append('g').selectAll('line')
      .data(edges).join('line')
      .attr('stroke', '#94a3b8').attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1)

    const dragBehavior = d3.drag<SVGGElement, GNode>()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x ?? 0; d.fy = d.y ?? 0 })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = undefined; d.fy = undefined })

    // Nodes
    const node = g.append('g').selectAll('g')
      .data(nodes).join('g')
      .style('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(dragBehavior as any)
      .on('click', (_e, d) => setSelected(d))

    // Glow effect
    node.append('circle')
      .attr('r', (d) => (12 + d.weight * 4) * 1.8)
      .attr('fill', (d) => d.color)
      .attr('opacity', 0.12)

    // Main circle
    node.append('circle')
      .attr('r', (d) => 10 + d.weight * 3)
      .attr('fill', (d) => d.color)
      .attr('stroke', 'white').attr('stroke-width', 1.5).attr('opacity', 0.88)

    // Label
    node.append('text')
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => 16 + d.weight * 3)
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .attr('pointer-events', 'none')

    sim.on('tick', () => {
      link
        .attr('x1', (d) => ((d.source as GNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GNode).y ?? 0))
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Fit to view after stabilization
    setTimeout(() => { svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1)) }, 1200)

    return () => { sim.stop() }
  }, [nodes, edges])

  const toggleFilter = (type: string) =>
    setFilter(f => f.includes(type) ? f.filter(x => x !== type) : [...f, type])

  const typeLabels: Record<string, string> = { note: 'Notlar', goal: 'Hedefler', person: 'Kişiler', tag: 'Etiketler', daily: 'Günlük' }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">Bilgi Grafiği</h1>
          <p className="text-xs text-slate-500 mt-0.5">{nodeCount} düğüm · {edges.length} bağlantı</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {Object.entries(typeLabels).map(([type, label]) => (
            <button key={type} onClick={() => toggleFilter(type)}
              className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors', filter.includes(type) ? 'text-white border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500')}
              style={filter.includes(type) ? { backgroundColor: TYPE_COLORS[type] } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Graph */}
        <div ref={containerRef} className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <span className="text-5xl mb-3">🌌</span>
              <p className="font-medium">Henüz bağlantı yok</p>
              <p className="text-sm mt-1">Not ve hedef ekledikçe grafik oluşacak</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full" />
          )}
          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            {Object.entries(typeLabels).filter(([t]) => filter.includes(t)).map(([t, l]) => (
              <div key={t} className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-full text-xs backdrop-blur-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shrink-0 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{typeLabels[selected.type]}</span>
            </div>
            <h3 className="font-semibold text-sm mb-3 leading-snug">{selected.label}</h3>
            {selected.type === 'note' && (
              <div className="space-y-2 text-xs text-slate-500">
                {Boolean(selected.data.category) && <div>Kategori: <span className="text-slate-700 dark:text-slate-300">{String(selected.data.category)}</span></div>}
                {Boolean(selected.data.emotion) && <div>Duygu: <span className="text-slate-700 dark:text-slate-300">{String(selected.data.emotion)}</span></div>}
                {Array.isArray(selected.data.tags) && (selected.data.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1">{(selected.data.tags as string[]).map(t => <span key={t} className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 rounded">{t}</span>)}</div>
                )}
                {Boolean(selected.data.content) && (
                  <p className="mt-2 line-clamp-6 leading-relaxed text-slate-400">
                    {String(selected.data.content).replace(/<[^>]*>/g, ' ').slice(0, 200)}
                  </p>
                )}
              </div>
            )}
            {selected.type === 'goal' && (
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${Number(selected.data.progress)}%` }} />
                  </div>
                  <span>%{Number(selected.data.progress)}</span>
                </div>
                {Boolean(selected.data.description) && <p className="line-clamp-4">{String(selected.data.description)}</p>}
              </div>
            )}
            {selected.type === 'tag' && (
              <p className="text-xs text-slate-400">Bu etiket {edges.filter(e => (e.target as GNode).id === selected.id || (e.source as GNode).id === selected.id).length} öğede kullanılıyor.</p>
            )}
            {selected.type === 'person' && (
              <p className="text-xs text-slate-400">Bu kişi {edges.filter(e => (e.target as GNode).id === selected.id || (e.source as GNode).id === selected.id).length} notta geçiyor.</p>
            )}
            <button onClick={() => setSelected(null)} className="mt-4 w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors">
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
