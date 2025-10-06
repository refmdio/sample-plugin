import { createKit, resolveDocId, escapeHtml } from '@refmdio/plugin-sdk'

const SAMPLE_KIND = 'sample'

// Entry point invoked by the host when the plugin route mounts.
export default async function mount(container, host) {
  const kit = createKit(host)
  const tokenFromHost = host?.context?.token ?? undefined
  const initialDocId = host?.context?.docId || resolveDocId()

  kit.store({
    container,
    initialState: { docId: initialDocId, records: [], loading: false, message: '', md: defaultMd(), initialized: false },
    render: (state, set) => {
      if (state.docId && !state.initialized) { set({ initialized: true }); void refreshRecords(state, set, host) }
      return kit.fragment(
        kit.card({
          title: 'Sample Plugin',
          body: kit.fragment(
            kit.h('div', { className: 'text-xs text-muted-foreground' }, 'Doc ID: ', kit.h('code', null, state.docId || '(not set)')),
            kit.h('div', { className: 'flex flex-wrap gap-2 mt-2' },
              kit.button({ label: 'Say hello', onClick: () => host.exec('sample.hello') }),
              kit.button({ label: 'Reload records', onClick: () => refreshRecords(state, set, host), disabled: !state.docId })
            ),
            kit.h('p', { className: 'text-xs text-muted-foreground max-w-xl mt-2' }, 'Use the “New Sample Document” command to provision a sandbox document, or open one from the file tree.')
          )
        }),

        kit.card({
          title: 'Sample records',
          body: kit.fragment(
            kit.h('form', { className: 'flex flex-wrap gap-2 items-center', onsubmit: (e) => { e.preventDefault(); void createRecord(state, set, host) } },
              kit.input({ value: state.message, placeholder: 'Message', onInput: (v) => set({ message: v }), style: 'min-width:220px', className: 'flex-1' }),
              kit.button({ label: 'Create', type: 'submit', disabled: !state.docId })
            ),
            (() => {
              const list = kit.h('div', { className: 'space-y-2 text-xs' })
              if (!state.docId) { list.appendChild(kit.h('div', { className: 'text-muted-foreground' }, '(no document selected)')); return list }
              if (!state.records?.length) { list.appendChild(kit.h('div', { className: 'text-muted-foreground' }, '(no records yet)')); return list }
              for (const item of state.records) list.appendChild(recordNode(kit, item, () => editRecord(item, state, set, host), () => deleteRecord(item, state, set, host)))
              return list
            })()
          ),
          footer: state.loading ? 'Loading records…' : `${state.records?.length || 0} record(s)`
        }),

        kit.card({
          title: 'Markdown preview',
          body: kit.fragment(
            kit.textarea({ value: state.md, onInput: (v) => set({ md: v }), rows: 8, className: 'h-28' }),
            kit.h('div', { className: 'flex gap-2' },
              kit.button({ label: 'Render preview', onClick: async () => {
                const out = container.querySelector('[data-sample-md-out]') || kit.h('div', { 'data-sample-md-out': '', className: 'border rounded p-2 prose prose-sm max-w-none' })
                if (!out.isConnected) container.appendChild(out)
                await kit.markdownPreview(state.md, out, {
                  flavor: 'sample', features: ['gfm', 'highlight'], sanitize: true, absolute_attachments: true,
                  base_origin: host?.origin,
                  doc_id: state.docId || undefined,
                  token: tokenFromHost,
                })
              } })
            )
          )
        })
      )
    }
  })

  async function refreshRecords(state, set, host) {
    if (!state.docId) return
    set({ loading: true })
    try {
      const response = await host.exec('host.records.list', {
        docId: state.docId,
        kind: SAMPLE_KIND,
        token: tokenFromHost,
      })
      if (response?.ok === false) throw new Error(response?.error?.message || response?.error?.code)
      const items = Array.isArray(response?.data?.items) ? response.data.items : []
      set({ records: items })
    } catch (err) { console.error('[sample] listRecords failed', err); set({ records: [] }) }
    finally { set({ loading: false }) }
  }

  async function createRecord(state, set, host) {
    if (!state.docId) return
    const message = (state.message || '').trim() || 'Hello from sample plugin'
    try { await host.exec('sample.create_record', { docId: state.docId, data: { message } }); set({ message: '' }); await refreshRecords(state, set, host) } catch (err) { console.error('[sample] create failed', err) }
  }
  async function editRecord(item, state, set, host) {
    const currentMessage = item && item.data && item.data.message
    const next = typeof prompt === 'function' ? prompt('Update message', currentMessage || '') : currentMessage
    if (next == null) return
    try { await host.exec('sample.update_record', { recordId: item.id, patch: { message: next } }); await refreshRecords(state, set, host) } catch (err) { console.error('[sample] update failed', err) }
  }
  async function deleteRecord(item, state, set, host) {
    if (typeof confirm === 'function' && !confirm('Delete this record?')) return
    try { await host.exec('sample.delete_record', { recordId: item.id }); await refreshRecords(state, set, host) } catch (err) { console.error('[sample] delete failed', err) }
  }
}

// Optional standalone exec helper matching the host command palette expectations.
export async function exec(action, { host, payload } = {}) {
  const call = host && (host.exec || host.api?.exec)
  if (typeof call !== 'function') {
    return { ok: false, error: { code: 'EXEC_NOT_AVAILABLE' } }
  }
  try {
    return await call(action, payload || {})
  } catch (err) {
    return { ok: false, error: { code: 'EXEC_ERROR', message: String(err && err.message || err) } }
  }
}

export async function canOpen(docId, ctx = {}) {
  const docType = ctx?.document?.type || ctx?.docType
  if (docType && docType === 'sample') return true
  try {
    const kvResult = await ctx?.host?.exec?.('host.kv.get', {
      docId,
      key: 'meta',
      token: ctx?.token || undefined,
    })
    if (kvResult?.ok === false) return false
    const kv = kvResult?.data
    if (kv && typeof kv === 'object') {
      const meta = typeof kv.value === 'object' && kv.value !== null ? kv.value : kv
      return Boolean(meta?.isSample)
    }
  } catch (err) {
    console.warn('[sample] canOpen getKv failed', err)
  }
  return false
}

export async function getRoute(docId, ctx = {}) {
  const token = ctx?.token ? `?token=${encodeURIComponent(ctx.token)}` : ''
  return `/sample/${docId}${token}`
}

function recordNode(kit, item, onEdit, onDelete) {
  const idText = escapeHtml(item.id || '(missing id)')
  const data = escapeHtml(JSON.stringify(item.data ?? {}, null, 2))
  const root = kit.h('div', { className: 'border rounded p-2 space-y-1' })
  const head = kit.h('div', { className: 'flex items-center justify-between gap-2' })
  head.appendChild(kit.h('span', { className: 'font-medium' }, idText))
  const actions = kit.h('div', { className: 'flex gap-1' })
  actions.appendChild(kit.button({ label: 'Edit', className: 'px-2 py-1 text-xs', onClick: onEdit }))
  actions.appendChild(kit.button({ label: 'Delete', className: 'px-2 py-1 text-xs', onClick: onDelete }))
  head.appendChild(actions)
  const body = kit.h('pre', { className: 'bg-muted/50 rounded p-2 overflow-x-auto' }, data)
  root.appendChild(head)
  root.appendChild(body)
  return root
}

function defaultMd() {
  return '## Sample plugin markdown demo\n\n- [[123e4567-e89b-12d3-a456-426614174000]]\n- **Bold**, _emphasis_, and `inline code`\n'
}
