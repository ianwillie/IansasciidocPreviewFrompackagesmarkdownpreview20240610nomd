const path = require('path')
const morphdom = require('morphdom')

const { Emitter, Disposable, CompositeDisposable, File } = require('atom')
const _ = require('underscore-plus')
const fs = require('fs-plus')

const renderer = require('./renderer')

module.exports = class IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView {
  static deserialize(params) {
    return new IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(params)
  }

  constructor({ editorId, filePath }) {
    this.editorId = editorId
    this.filePath = filePath
    this.element = document.createElement('div')
    this.element.classList.add('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd')
    this.element.tabIndex = -1

    this.emitter = new Emitter()
    this.loaded = false
    this.disposables = new CompositeDisposable()
    this.registerScrollCommands()
    if (this.editorId != null) {
      this.resolveEditor(this.editorId)
    } else if (atom.packages.hasActivatedInitialPackages()) {
      this.subscribeToFilePath(this.filePath)
    } else {
      this.disposables.add(
        atom.packages.onDidActivateInitialPackages(() => {
          this.subscribeToFilePath(this.filePath)
        })
      )
    }
    this.editorCache = new renderer.EditorCache(editorId)
  }

  serialize() {
    return {
      deserializer: 'IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView',
      filePath: this.getPath() != null ? this.getPath() : this.filePath,
      editorId: this.editorId
    }
  }

  copy() {
    return new IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView({
      editorId: this.editorId,
      filePath: this.getPath() != null ? this.getPath() : this.filePath
    })
  }

  destroy() {
    this.disposables.dispose()
    this.element.remove()
    this.editorCache.destroy()
  }

  registerScrollCommands() {
    this.disposables.add(
      atom.commands.add(this.element, {
        'core:move-up': () => {
          this.element.scrollTop -= document.body.offsetHeight / 20
        },
        'core:move-down': () => {
          this.element.scrollTop += document.body.offsetHeight / 20
        },
        'core:page-up': () => {
          this.element.scrollTop -= this.element.offsetHeight
        },
        'core:page-down': () => {
          this.element.scrollTop += this.element.offsetHeight
        },
        'core:move-to-top': () => {
          this.element.scrollTop = 0
        },
        'core:move-to-bottom': () => {
          this.element.scrollTop = this.element.scrollHeight
        }
      })
    )
  }

  onDidChangeTitle(callback) {
    return this.emitter.on('did-change-title', callback)
  }

  onDidChangeModified(_callback) {
    // No op to suppress deprecation warning
    return new Disposable()
  }

  onDidChangeMarkdown(callback) {
    return this.emitter.on('did-change-markdown', callback)
  }

  subscribeToFilePath(filePath) {
    this.file = new File(filePath)
    this.emitter.emit('did-change-title')
    this.disposables.add(
      this.file.onDidRename(() => this.emitter.emit('did-change-title'))
    )
    this.handleEvents()
    return this.renderMarkdown()
  }

  resolveEditor(editorId) {
    const resolve = () => {
      this.editor = this.editorForId(editorId)

      if (this.editor != null) {
        this.emitter.emit('did-change-title')
        this.disposables.add(
          this.editor.onDidDestroy(() =>
            this.subscribeToFilePath(this.getPath())
          )
        )
        this.handleEvents()
        this.renderMarkdown()
      } else {
        this.subscribeToFilePath(this.filePath)
      }
    }

    if (atom.packages.hasActivatedInitialPackages()) {
      resolve()
    } else {
      this.disposables.add(atom.packages.onDidActivateInitialPackages(resolve))
    }
  }

  editorForId(editorId) {
    for (const editor of atom.workspace.getTextEditors()) {
      if (editor.id != null && editor.id.toString() === editorId.toString()) {
        return editor
      }
    }
    return null
  }

  handleEvents() {
    const lazyRenderMarkdown = _.debounce(() => this.renderMarkdown(), 250)
    this.disposables.add(
      atom.grammars.onDidAddGrammar(() => lazyRenderMarkdown())
    )
    if (typeof atom.grammars.onDidRemoveGrammar === 'function') {
      this.disposables.add(
        atom.grammars.onDidRemoveGrammar(() => lazyRenderMarkdown())
      )
    } else {
      // TODO: Remove onDidUpdateGrammar hook once onDidRemoveGrammar is released
      this.disposables.add(
        atom.grammars.onDidUpdateGrammar(() => lazyRenderMarkdown())
      )
    }

    atom.commands.add(this.element, {
      'core:copy': event => {
        event.stopPropagation()
        return this.copyToClipboard()
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:select-all': () => {
        this.selectAll()
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:zoom-in': () => {
        const zoomLevel = parseFloat(getComputedStyle(this.element).zoom)
        this.element.style.zoom = zoomLevel + 0.1
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:zoom-out': () => {
        const zoomLevel = parseFloat(getComputedStyle(this.element).zoom)
        this.element.style.zoom = zoomLevel - 0.1
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:reset-zoom': () => {
        this.element.style.zoom = 1
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:toggle-break-on-single-newline'() {
        const keyPath = 'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.breakOnSingleNewline'
        atom.config.set(keyPath, !atom.config.get(keyPath))
      },
      'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:toggle-github-style'() {
        const keyPath = 'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.useGitHubStyle'
        atom.config.set(keyPath, !atom.config.get(keyPath))
      }
    })

    const changeHandler = () => {
      this.renderMarkdown()

      const pane = atom.workspace.paneForItem(this)
      if (pane != null && pane !== atom.workspace.getActivePane()) {
        pane.activateItem(this)
      }
    }

    if (this.file) {
      this.disposables.add(this.file.onDidChange(changeHandler))
    } else if (this.editor) {
      this.disposables.add(
        this.editor.getBuffer().onDidStopChanging(function () {
          if (atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.liveUpdate')) {
            changeHandler()
          }
        })
      )
      this.disposables.add(
        this.editor.onDidChangePath(() => this.emitter.emit('did-change-title'))
      )
      this.disposables.add(
        this.editor.getBuffer().onDidSave(function () {
          if (!atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.liveUpdate')) {
            changeHandler()
          }
        })
      )
      this.disposables.add(
        this.editor.getBuffer().onDidReload(function () {
          if (!atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.liveUpdate')) {
            changeHandler()
          }
        })
      )
    }

    this.disposables.add(
      atom.config.onDidChange(
        'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.breakOnSingleNewline',
        changeHandler
      )
    )

    this.disposables.add(
      atom.config.observe('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.gitHubStyleMode', gitHubStyleMode => {
        this.gitHubStyleMode = gitHubStyleMode
        if (this.useGitHubStyle) {
          this.element.setAttribute('data-use-github-style', gitHubStyleMode)
        }
      })
    )

    this.disposables.add(
      atom.config.observe('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.useGitHubStyle', useGitHubStyle => {
        this.useGitHubStyle = useGitHubStyle
        if (useGitHubStyle) {
          this.element.setAttribute('data-use-github-style', this.gitHubStyleMode)
        } else {
          this.element.removeAttribute('data-use-github-style')
        }
      })
    )

    document.onselectionchange = () => {
      const selection = window.getSelection()
      const selectedNode = selection.baseNode
      if (
        selectedNode === null ||
        this.element === selectedNode ||
        this.element.contains(selectedNode)
      ) {
        if (selection.isCollapsed) {
          this.element.classList.remove('has-selection')
        } else {
          this.element.classList.add('has-selection')
        }
      }
    }
  }

  renderMarkdown() {
    if (!this.loaded) {
      this.showLoading()
    }
    return this.getMarkdownSource()
      .then(source => {
        if (source != null) {
          if (this.loaded) {
            return this.renderMarkdownText(source);
          } else {
            // If we haven't loaded yet, defer before we render the Markdown
            // for the first time. This allows the pane to appear and to
            // display the loading indicator. Otherwise the first render
            // happens before the pane is even visible.
            //
            // This doesn't slow anything down; it just shifts the work around
            // so that the pane appears earlier in the cycle.
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(this.renderMarkdownText(source))
              }, 0)
            })
          }
        }
      })
      .catch(reason => this.showError({ message: reason }))
  }

  getMarkdownSource() {
    if (this.file && this.file.getPath()) {
      return this.file
        .read()
        .then(source => {
          if (source === null) {
            return Promise.reject(
              new Error(`${this.file.getBaseName()} could not be found`)
            )
          } else {
            return Promise.resolve(source)
          }
        })
        .catch(reason => Promise.reject(reason))
    } else if (this.editor != null) {
      return Promise.resolve(this.editor.getText())
    } else {
      return Promise.reject(new Error('No editor found'))
    }
  }

  async getHTML() {
    const source = await this.getMarkdownSource()

    if (source == null) {
      return
    }

    return renderer.toHTML(source, this.getPath(), this.getGrammar())
  }

  async renderMarkdownText(text) {
    const { scrollTop } = this.element
    try {
      const [domFragment, done] = await renderer.toDOMFragment(
        text,
        this.getPath(),
        this.getGrammar(),
        this.editorId
      )

      this.loading = false
      this.loaded = true

      // Clone the existing container
      let newElement = this.element.cloneNode(false)
      newElement.appendChild(domFragment)

      morphdom(this.element, newElement, {
        onBeforeNodeDiscarded(node) {
          // Don't discard `atom-text-editor` elements despite the fact that
          // they don't exist in the new content.
          if (node.nodeName === 'ATOM-TEXT-EDITOR') {
            return false
          }
        }
      })

      await done(this.element)
      this.element.classList.remove('loading')

      this.emitter.emit('did-change-markdown')
      this.element.scrollTop = scrollTop
    } catch (error) {
      this.showError(error)
    }
  }

  getTitle() {
    if (this.file != null && this.getPath() != null) {
      return `${path.basename(this.getPath())} Preview`
    } else if (this.editor != null) {
      return `${this.editor.getTitle()} Preview`
    } else {
      return 'Iansasciidoc Previewfrompackagesmarkdownpreview20240610nomd'
    }
  }

  getIconName() {
    return 'markdown'
  }

  getURI() {
    if (this.file != null) {
      return `iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd://${this.getPath()}`
    } else {
      return `iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd://editor/${this.editorId}`
    }
  }

  getPath() {
    if (this.file != null) {
      return this.file.getPath()
    } else if (this.editor != null) {
      return this.editor.getPath()
    }
  }

  getGrammar() {
    return this.editor != null ? this.editor.getGrammar() : undefined
  }

  getDocumentStyleSheets() {
    // This function exists so we can stub it
    return document.styleSheets
  }

  getTextEditorStyles() {
    const textEditorStyles = document.createElement('atom-styles')
    textEditorStyles.initialize(atom.styles)
    textEditorStyles.setAttribute('context', 'atom-text-editor')
    document.body.appendChild(textEditorStyles)

    // Extract style elements content
    return Array.prototype.slice
      .apply(textEditorStyles.childNodes)
      .map(styleElement => styleElement.innerText)
  }

  getIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdCSS() {
    const markdownPreviewRules = []
    const ruleRegExp = /\.iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd/
    const cssUrlRegExp = /url\(atom:\/\/iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd\/assets\/(.*)\)/

    for (const stylesheet of this.getDocumentStyleSheets()) {
      if (stylesheet.rules != null) {
        for (const rule of stylesheet.rules) {
          // We only need `.markdown-review` css
          if (rule.selectorText && rule.selectorText.match(ruleRegExp)) {
            markdownPreviewRules.push(rule.cssText)
          }
        }
      }
    }

    return markdownPreviewRules
      .concat(this.getTextEditorStyles())
      .join('\n')
      .replace(/atom-text-editor/g, 'pre.editor-colors')
      .replace(/:host/g, '.host') // Remove shadow-dom :host selector causing problem on FF
      .replace(cssUrlRegExp, function (_match, assetsName, _offset, _string) {
        // base64 encode assets
        const assetPath = path.join(__dirname, '../assets', assetsName)
        const originalData = fs.readFileSync(assetPath, 'binary')
        const base64Data = Buffer.from(originalData, 'binary').toString(
          'base64'
        )
        return `url('data:image/jpeg;base64,${base64Data}')`
      })
  }

  showError(result) {
    this.element.textContent = ''
    this.element.classList.remove('loading')
    const h2 = document.createElement('h2')
    h2.textContent = 'Previewing Markdown Failed'
    this.element.appendChild(h2)
    if (result) {
      const h3 = document.createElement('h3')
      h3.textContent = result.message
      this.element.appendChild(h3)
    }
  }

  showLoading() {
    this.loading = true
    this.element.classList.add('loading')
  }

  selectAll() {
    if (this.loading) {
      return
    }

    const selection = window.getSelection()
    selection.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(this.element)
    selection.addRange(range)
  }

  async copyToClipboard() {
    if (this.loading) {
      return
    }

    const selection = window.getSelection()
    const selectedText = selection.toString()
    const selectedNode = selection.baseNode

    // Use default copy event handler if there is selected text inside this view
    if (
      selectedText &&
      selectedNode != null &&
      (this.element === selectedNode || this.element.contains(selectedNode))
    ) {
      atom.clipboard.write(selectedText)
    } else {
      try {
        const html = await this.getHTML()

        atom.clipboard.write(html)
      } catch (error) {
        atom.notifications.addError('Copying Markdown as HTML failed', {
          dismissable: true,
          detail: error.message
        })
      }
    }
  }

  getSaveDialogOptions() {
    let defaultPath = this.getPath()
    if (defaultPath) {
      defaultPath += '.html'
    } else {
      let projectPath
      defaultPath = 'untitled.md.html'
      if ((projectPath = atom.project.getPaths()[0])) {
        defaultPath = path.join(projectPath, defaultPath)
      }
    }

    return { defaultPath }
  }

  async saveAs(htmlFilePath) {
    if (this.loading) {
      atom.notifications.addWarning(
        'Please wait until the Iansasciidoc Previewfrompackagesmarkdownpreview20240610nomd has finished loading before saving'
      )
      return
    }

    const filePath = this.getPath()
    let title = 'Markdown to HTML'
    if (filePath) {
      title = path.parse(filePath).name
    }

    const htmlBody = await this.getHTML()

    const html =
      `\
<!DOCTYPE html>
<html>
  <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>${this.getIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdCSS()}</style>
  </head>
  <body class='iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd' data-use-github-style="${this.gitHubStyleMode}">${htmlBody}</body>
</html>` + '\n' // Ensure trailing newline

    fs.writeFileSync(htmlFilePath, html)
    return atom.workspace.open(htmlFilePath)
  }
}
