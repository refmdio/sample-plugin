const SAMPLE_KIND = 'sample'

// Entry point invoked by the host when the plugin route mounts.
export default async function mount(container, host) {
  const state = {
    docId: resolveDocId(),
    records: [],
    loading: false,
  }

  container.innerHTML = renderShell(state.docId)

  const ui = {
    docLabel: container.querySelector('[data-id="doc-label"]'),
    recordForm: container.querySelector('[data-id="record-form"]'),
    recordMessage: container.querySelector('[data-id="record-message"]'),
    recordList: container.querySelector('[data-id="record-list"]'),
    recordStatus: container.querySelector('[data-id="record-status"]'),
    mdInput: container.querySelector('[data-id="md-input"]'),
    mdOutput: container.querySelector('[data-id="md-output"]'),
  }

  updateDocInfo()
  updateRecordControls()

  if (state.docId) {
    await refreshRecords()
  } else {
    setRecordStatus('Select a sample document to view records.')
    renderRecords()
  }

  await renderMarkdown()

  container.addEventListener('submit', async (event) => {
    if (event.target === ui.recordForm) {
      event.preventDefault()
      await handleCreateRecord()
    }
  })

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]')
    if (!button || !container.contains(button)) return
    const action = button.getAttribute('data-action')
    try {
      if (action === 'say-hello') {
        await callAction('sample.hello')
      } else if (action === 'reload-records') {
        await refreshRecords()
      } else if (action === 'render-md') {
        await renderMarkdown()
      } else if (action === 'edit-record') {
        const id = button.getAttribute('data-record-id')
        if (id) await handleUpdateRecord(id)
      } else if (action === 'delete-record') {
        const id = button.getAttribute('data-record-id')
        if (id) await handleDeleteRecord(id)
      }
    } catch (err) {
      console.error('[sample] action failed', err)
    }
  })

  return () => {
    try { container.innerHTML = '' } catch {}
  }

  function updateDocInfo() {
    if (!ui.docLabel) return
    ui.docLabel.textContent = state.docId || '(not set)'
  }

  function updateRecordControls() {
    const toggles = container.querySelectorAll('[data-requires-doc]')
    toggles.forEach((el) => {
      el.disabled = !state.docId
    })
  }

  async function handleCreateRecord() {
    if (!state.docId) {
      setRecordStatus('No document selected')
      return
    }
    const message = (ui.recordMessage?.value || '').trim() || 'Hello from sample plugin'
    setRecordStatus('Creating...')
    try {
      await callAction('sample.create_record', {
        docId: state.docId,
        data: { message },
      })
      if (ui.recordMessage) ui.recordMessage.value = ''
      await refreshRecords()
      setRecordStatus('Created a record')
    } catch (err) {
      console.error('[sample] create failed', err)
      setRecordStatus('Failed to create record')
    }
  }

  async function handleUpdateRecord(recordId) {
    if (!state.docId) return
    const record = state.records.find((item) => item.id === recordId)
    const currentMessage = record && record.data && record.data.message
    const next = prompt('Update message', currentMessage || '')
    if (next === null) return
    setRecordStatus('Updating...')
    try {
      await callAction('sample.update_record', {
        recordId,
        patch: { message: next },
      })
      await refreshRecords()
      setRecordStatus('Record updated')
    } catch (err) {
      console.error('[sample] update failed', err)
      setRecordStatus('Failed to update record')
    }
  }

  async function handleDeleteRecord(recordId) {
    if (!state.docId) return
    if (!confirm('Delete this record?')) return
    setRecordStatus('Deleting...')
    try {
      await callAction('sample.delete_record', { recordId })
      await refreshRecords()
      setRecordStatus('Record deleted')
    } catch (err) {
      console.error('[sample] delete failed', err)
      setRecordStatus('Failed to delete record')
    }
  }

  async function refreshRecords() {
    if (!state.docId) return
    state.loading = true
    setRecordStatus('Loading records...')
    try {
      const result = await host.api.listRecords('sample', state.docId, SAMPLE_KIND)
      const items = Array.isArray(result?.items) ? result.items : []
      state.records = items
      renderRecords()
      setRecordStatus(`${items.length} record(s) loaded`)
    } catch (err) {
      console.error('[sample] listRecords failed', err)
      setRecordStatus('Failed to load records')
      state.records = []
      renderRecords()
    } finally {
      state.loading = false
    }
  }

  async function renderMarkdown() {
    const source = ui.mdInput?.value || ''
    if (!ui.mdOutput) return
    try {
      const apiOrigin = host?.origin || (typeof location !== 'undefined' ? location.origin : '')
      const token = (() => {
        try { return new URLSearchParams(location.search).get('token') || undefined } catch { return undefined }
      })()
      const out = await host.api.renderMarkdown(source, {
        flavor: 'sample',
        features: ['gfm', 'highlight'],
        sanitize: true,
        absolute_attachments: true,
        base_origin: apiOrigin,
        doc_id: state.docId || undefined,
        token,
      })
      ui.mdOutput.innerHTML = out?.html || ''
      await host.ui.hydrateAll?.(ui.mdOutput)
    } catch (err) {
      console.error('[sample] renderMarkdown failed', err)
      ui.mdOutput.textContent = 'Failed to render markdown'
    }
  }

  function renderRecords() {
    if (!ui.recordList) return
    if (!state.docId) {
      ui.recordList.innerHTML = '<div class="text-muted-foreground">(no document selected)</div>'
      return
    }
    if (!state.records.length) {
      ui.recordList.innerHTML = '<div class="text-muted-foreground">(no records yet)</div>'
      return
    }
    const nodes = state.records.map((item) => {
      const id = escapeHtml(item.id || '(missing id)')
      const data = escapeHtml(JSON.stringify(item.data ?? {}, null, 2))
      return `
        <div class="border rounded p-2 space-y-1">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">${id}</span>
            <div class="flex gap-1">
              <button data-action="edit-record" data-record-id="${id}" class="px-2 py-1 border rounded text-xs" data-requires-doc>Edit</button>
              <button data-action="delete-record" data-record-id="${id}" class="px-2 py-1 border rounded text-xs" data-requires-doc>Delete</button>
            </div>
          </div>
          <pre class="bg-muted/50 rounded p-2 overflow-x-auto">${data}</pre>
        </div>
      `
    })
    ui.recordList.innerHTML = nodes.join('')
  }

  async function callAction(action, payload) {
    const exec = host?.exec || host?.api?.exec
    if (typeof exec !== 'function') throw new Error('host.exec is not available')
    return await exec(action, payload || {})
  }

  function setRecordStatus(text) {
    if (!ui.recordStatus) return
    ui.recordStatus.textContent = text || ''
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
    const kv = await ctx?.host?.api?.getKv?.('sample', docId, 'meta', ctx?.token || undefined)
    if (kv && typeof kv === 'object') {
      return Boolean(kv.isSample)
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

function resolveDocId() {
  try {
    const params = new URLSearchParams(location.search)
    const fromQuery = params.get('docId') || params.get('id')
    if (fromQuery) return fromQuery
    const pathname = params.get('path') || location.pathname
    const sampleMatch = pathname.match(/\/sample\/([0-9a-fA-F-]{36})$/)
    if (sampleMatch && sampleMatch[1]) return sampleMatch[1]
    const docMatch = pathname.match(/\/document\/([0-9a-fA-F-]{36})$/)
    if (docMatch && docMatch[1]) return docMatch[1]
  } catch {}
  return ''
}

function renderShell(docId) {
  return `
    <div class="p-4 space-y-4 text-sm">
      <section class="space-y-2">
        <h2 class="text-base font-semibold">Sample Plugin</h2>
        <div class="text-xs text-muted-foreground">Doc ID: <code data-id="doc-label">${docId || '(not set)'}</code></div>
        <div class="flex flex-wrap gap-2">
          <button data-action="say-hello" class="px-3 py-1.5 border rounded">Say hello</button>
          <button data-action="reload-records" class="px-3 py-1.5 border rounded" data-requires-doc ${docId ? '' : 'disabled'}>Reload records</button>
        </div>
        <p class="text-xs text-muted-foreground max-w-xl">
          Use the “New Sample Document” command from the toolbar to create a sandbox document,
          or open an existing one from the file tree.
        </p>
      </section>

      <section class="space-y-3 border rounded p-3 bg-card/50">
        <header class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-medium">Sample records</h3>
            <p class="text-xs text-muted-foreground">Create, update, delete records via Extism effects.</p>
          </div>
          <span data-id="record-status" class="text-xs text-muted-foreground"></span>
        </header>
        <form data-id="record-form" class="flex flex-wrap gap-2 items-center">
          <input data-id="record-message" type="text" class="flex-1 px-2 py-1 border rounded" style="min-width:220px" placeholder="Message" />
          <button data-action="create-record" class="px-3 py-1.5 border rounded" data-requires-doc ${docId ? '' : 'disabled'}>Create</button>
        </form>
        <div data-id="record-list" class="space-y-2 text-xs"></div>
      </section>

      <section class="space-y-2 border rounded p-3 bg-card/50">
        <h3 class="text-sm font-medium">Markdown preview</h3>
        <textarea data-id="md-input" class="w-full h-28 p-2 border rounded" placeholder="Type markdown to render...">## Sample plugin markdown demo\n\n- [[123e4567-e89b-12d3-a456-426614174000]]\n- **Bold**, _emphasis_, and &#96;inline code&#96;\n</textarea>
        <div class="flex gap-2">
          <button data-action="render-md" class="px-3 py-1.5 border rounded">Render preview</button>
        </div>
        <div data-id="md-output" class="border rounded p-2 prose prose-sm max-w-none"></div>
      </section>
    </div>
  `
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}
