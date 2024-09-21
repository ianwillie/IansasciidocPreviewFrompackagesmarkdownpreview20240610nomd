const fs = require('fs-plus');const path = require("path");
const { CompositeDisposable } = require('atom')

let IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView = null
let renderer = null

const isIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView = function (object) {
  if (IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView == null) {
    IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView = require('./iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd-view')
  }
  return object instanceof IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView
}

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable()
    this.commandSubscriptions = new CompositeDisposable()

    this.style = new CSSStyleSheet()

    // TODO: When we upgrade Electron, we can push onto `adoptedStyleSheets`
    // directly. For now, we have to do this silly thing.
    let styleSheets = Array.from(document.adoptedStyleSheets ?? [])
    styleSheets.push(this.style)
    document.adoptedStyleSheets = styleSheets

    this.disposables.add(
      atom.config.observe('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.grammars', grammars => {
        this.commandSubscriptions.dispose()
        this.commandSubscriptions = new CompositeDisposable()

        if (grammars == null) {
          grammars = []
        }

        for (const grammar of grammars.map(grammar =>
          grammar.replace(/\./g, ' ')
        )) {
          this.commandSubscriptions.add(
            atom.commands.add(`atom-text-editor[data-grammar='${grammar}']`, {
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:toggle': () => this.toggle(),
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:copy-html': {
                displayName: 'Iansasciidoc Previewfrompackagesmarkdownpreview20240610nomd: Copy HTML',
                didDispatch: () => this.copyHTML()
              },
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:save-as-html': {
                displayName: 'Iansasciidoc Previewfrompackagesmarkdownpreview20240610nomd: Save as HTML',
                didDispatch: () => this.saveAsHTML()
              },
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:toggle-break-on-single-newline': () => {
                const keyPath = 'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.breakOnSingleNewline'
                atom.config.set(keyPath, !atom.config.get(keyPath))
              },
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:toggle-github-style': () => {
                const keyPath = 'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.useGitHubStyle'
                atom.config.set(keyPath, !atom.config.get(keyPath))
              },
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:open-browser-popup': {
                displayName: 'Asciidoc/Markdown Preview: Open in External Browser',
                didDispatch: () => this.openBrowserPopup()
              },
              'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:save-to-backend': {
                displayName: 'saveToBackend: Save to Asciidoctor backend',
                didDispatch: () => this.saveToBackend()
              }
            })
          )
        }
      })
    )

    this.disposables.add(
      atom.config.observe('editor.fontFamily', (fontFamily) => {
        // Keep the user's `fontFamily` setting in sync with preview styles.
        // `pre` blocks will use this font automatically, but `code` elements
        // need a specific style rule.
        //
        // Since this applies to all content, we should declare this only once,
        // instead of once per preview view.
        this.style.replaceSync(`
          .iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd code {
            font-family: ${fontFamily} !important;
          }
        `)
      })
    )

    const previewFile = this.previewFile.bind(this)
    for (const extension of [
      'markdown',
      'md',
      'mdown',
      'mkd',
      'mkdown',
      'ron',
      'txt',
      'adoc'
    ])
    {
      this.disposables.add(
        atom.commands.add(
          `.tree-view .file .name[data-name$=\\.${extension}]`,
          'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd:preview-file',
          previewFile
        )
      )
    }

    this.disposables.add(
      atom.workspace.addOpener(uriToOpen => {
        let [protocol, path] = uriToOpen.split('://')
        if (protocol !== 'iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd') {
          return
        }

        try {
          path = decodeURI(path)
        } catch (error) {
          return
        }

        if (path.startsWith('editor/')) {
          return this.createIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView({ editorId: path.substring(7) })
        } else {
          return this.createIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView({ filePath: path })
        }
      })
    )
  },

  deactivate() {
    this.disposables.dispose()
    this.commandSubscriptions.dispose()
  },

  createIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(state) {
    if (state.editorId || fs.isFileSync(state.filePath)) {
      if (IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView == null) {
        IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView = require('./iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd-view')
      }
      return new IansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(state)
    }
  },

  toggle() {
    if (isIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(atom.workspace.getActivePaneItem())) {
      atom.workspace.destroyActivePaneItem()
      return
    }

    const editor = atom.workspace.getActiveTextEditor()
    if (editor == null) {
      return
    }

    const grammars = atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.grammars') || []
    if (!grammars.includes(editor.getGrammar().scopeName)) {
      return
    }

    if (!this.removePreviewForEditor(editor)) {
      return this.addPreviewForEditor(editor)
    }
  },

  uriForEditor(editor) {
    return `iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd://editor/${editor.id}`
  },

  removePreviewForEditor(editor) {
    const uri = this.uriForEditor(editor)
    const previewPane = atom.workspace.paneForURI(uri)
    if (previewPane != null) {
      previewPane.destroyItem(previewPane.itemForURI(uri))
      return true
    } else {
      return false
    }
  },

  addPreviewForEditor(editor) {
    const uri = this.uriForEditor(editor)
    const previousActivePane = atom.workspace.getActivePane()
    const options = { searchAllPanes: true }
    if (atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.openPreviewInSplitPane')) {
      options.split = 'right'
    }

    return atom.workspace
      .open(uri, options)
      .then(function (markdownPreviewView) {
        if (isIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(markdownPreviewView)) {
          previousActivePane.activate()
        }
      })
  },

  previewFile({ target }) {
    const filePath = target.dataset.path
    if (!filePath) {
      return
    }

    for (const editor of atom.workspace.getTextEditors()) {
      if (editor.getPath() === filePath) {
        return this.addPreviewForEditor(editor)
      }
    }

    atom.workspace.open(`iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd://${encodeURI(filePath)}`, {
      searchAllPanes: true
    })
  },

  async copyHTML() {
    const editor = atom.workspace.getActiveTextEditor()
    if (editor == null) {
      return
    }

    if (renderer == null) {
      renderer = require('./renderer')
    }
    const text = editor.getSelectedText() || editor.getText()
    const html = await renderer.toHTML(
      text,
      editor.getPath(),
      editor.getGrammar(),
      editor.id
    )

    atom.clipboard.write(html)
  },

  saveAsHTML() {
    const activePaneItem = atom.workspace.getActivePaneItem()
    if (isIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(activePaneItem)) {
      atom.workspace.getActivePane().saveItemAs(activePaneItem)
      return
    }

    const editor = atom.workspace.getActiveTextEditor()
    if (editor == null) {
      return
    }

    const grammars = atom.config.get('iansasciidoc-previewfrompackagesmarkdownpreview20240610nomd.grammars') || []
    if (!grammars.includes(editor.getGrammar().scopeName)) {
      return
    }

    const uri = this.uriForEditor(editor)
    const markdownPreviewPane = atom.workspace.paneForURI(uri)
    const markdownPreviewPaneItem =
      markdownPreviewPane != null
        ? markdownPreviewPane.itemForURI(uri)
        : undefined

    if (isIansasciidocPreviewfrompackagesmarkdownpreview20240610nomdView(markdownPreviewPaneItem)) {
      return markdownPreviewPane.saveItemAs(markdownPreviewPaneItem)
    }
  },


// called wi ctrl-alt-shift-F  NB ctrl-alt-shift-B is used by JavaScript copied to clipboard too at end commented our for now
    //  Packages>Settings View>Show Keybindings
    openBrowserPopup() {

      const editor = atom.workspace.getActiveTextEditor(); // put cursor in .adoc file and press ctrl-alt-shift-f for Falkon browser
      if (editor == null) { return };
      const getPath = editor.getPath(); // /media/AcerWinData/github_from_home/IansascidocPreviewFrommarkdownpreviewnomd/TEST_Adoc_MD_Files_Etc/asciidoc_VShort_CSSExplore.adoc
      console.log(`OBP getPath= ${getPath}`);
      //if ( path.extname(getPath) != 'adoc' ) { alert("Ext not .adoc l273"); return }; // or other adoc file extx
      const getHTMLPathToWrite = getPath + '.html'; //cf https://nodejs.org/api/path.html#pathextnamepath
      console.log(`OBP getHTMLPathToWrite= ${getHTMLPathToWrite}`);
      const text = editor.getText(); //get all .adoc text in file
      console.log(`OBP words=\n ${text}`); // => all .adoc file

    //  const wordsHTML = renderAsciidoctor(words);  //cd renderer.js l57

      const Asciidoctor = require('asciidoctor')(); // do what rendered.js.renderAsciidoctor() does but tailored
      let textToHTML = '';
      //textToHTML = Asciidoctor.convert(text, {'safe': 'server'} ); //various options for asciidoctor.convert
      //textToHTML = Asciidoctor.convert(text, {'safe': 'server',  'sourcemap': true,
      //'attributes': {'allow-url-read': true, 'source-highlighter': 'highlight.js', 'standalone': true }}    ); // , WORKS
      // textToHTML = Asciidoctor.convert(text,   { 'safe': 'server',   'attributes': { 'showtitle': true }}); // ,  WORKS
       textToHTML = Asciidoctor.convert(text, {   'safe':'safe',
       'attributes': { 'linkcss': false , 'icons': 'font'}});  // WORKS can be changed in adoc file front matter

       console.log(`OBP ianschange <li> textToHTML >/li> = \n <li> ${textToHTML}</li>\n `);
       /* ianschange removing template seems to make no difference */
      /* const template = document.createElement('template')
       template.innerHTML = html.trim()
       // If deep= true, node and its whole subtree, including text that may be in child Text nodes, is also copied.
       const fragment = template.content.cloneNode(true)
       //if (!isAsciidoctor) {resolveImagePaths(fragment, filePath) };// ianscomment seems to have no effect
       //return fragment
       const wordsHTML = fragment; */

      console.log(`OBP wordsHTML=\n ${textToHTML}`);
      const getURI = editor.getURI(); ///media/AcerWinData/github_from_home/IansascidocPreviewFrommarkdownpreviewnomd/TEST_Adoc_MD_Files_Etc/asciidoc_VShort_CSSExplore.adoc
      console.log(`OBP getURI= ${getURI}`);

      const filePath = getHTMLPathToWrite; // 'atomClipboard.html' //
      console.log(`OBP filePath = ${filePath}`);
      this.copyHTML();
      const atomClipboard = atom.clipboard.read();
      console.log(`OBP wordsHTML=\n ${textToHTML}`);
      const fs =  require("fs");
      //fs.writeFileSync( path.join(htmloutputDir,  tempDir, 'iansasciidocpreviewtransformscale.txt'), String((Number(XXXtransformScale)).toFixed(2)));
      fs.writeFileSync( path.join( getHTMLPathToWrite), String(textToHTML))
      ;
      const cp = require("child_process");
      //fileToOpen = "/media/AcerWinData/github_from_home/IansascidocPreviewFrommarkdownpreviewnomd/TEST_Adoc_MD_Files_Etc/asciidoc_syntax_VShort_CodeBlocks.adoc.html";
      cp.exec(`/usr/bin/falkon ${filePath} `);
      //alert( `about to return from openBrowserPopup`);

      return;
    },

    saveToBackend() {
      console.log('enter saveToBackend')
      const editor = atom.workspace.getActiveTextEditor(); // put cursor in .adoc file and press ctrl-alt-shift-f for Falkon browser
      if (editor == null) { return };
      const getPath = editor.getPath(); // /media/AcerWinData/github_from_home/IansascidocPreviewFrommarkdownpreviewnomd/TEST_Adoc_MD_Files_Etc/asciidoc_VShort_CSSExplore.adoc
      console.log(`sTB getPath= ${getPath}`);
      let getPdfPathToRead = getPath  // + '.adoc'; //.pdf replaces last extension
      console.log(`sTB getPdfPathToRead= ${getPdfPathToRead}`);
      const f = path.parse(getPath)
      let getPdfPathToWrite = f.name + '_Web' + f.ext ; console.log(`getPdfPathToWrite = ${getPdfPathToWrite} `);

    /*  const cp = require("child_process");
      let outputStderr = ''
      //outputStderr = cp.execSync(`asciidoctor-web-pdf --backend=pdf --verbose ${getPdfPathToWrite} `);//--backend => backend pdf not implemented
     outputStderr = cp.execSync(`asciidoctor-web-pdf --verbose  --output ${getPdfPathToWrite} ${getPdfPathToRead}`);  // js version .pdf replaces last extension -o not functioning
      console.log(`outputStderr = ${outputStderr}`)
      console.log(`sTB just saved using asciidoctor-web-pdf to  ${getPdfPathToWrite} `) */

      var exec = require('child_process').exec
      //exec(`asciidoctor-web-pdf --verbose  --out-file ${getPdfPathToWrite} ${getPdfPathToRead}`, function (error, stdout, stderr) {  // js version .pdf replaces last extension -o not functioning
      exec(`asciidoctor-web-pdf --verbose   ${getPdfPathToRead}`, function (error, stdout, stderr) { // --out-file ${getPdfPathToWrite} does not do .pdf it seems
        console.log('stdout: ' + stdout); console.log('stderr: ' + stderr); console.log('error: ' + error);
      });


      /* https://stackoverflow.com/questions/29625412/node-js-read-and-execute-a-ruby-file */
      // var exec = require('child_process').exec
      //getPdfPathToWrite = getPath + 'RbNoWeb' ;
      //
      //exec('/home/ian/.rvm/gems/ruby-3.1.2/bin/asciidoctor-pdf    ${getPdfPathToRead} ', function (error, stdout, stderr) { // ERROR ruby file fails
      //exec(' /home/ian/.nvm/versions/node/v16.20.2/bin/asciidoctor-pdf  DEPRECATEE & will be removed use -web-pdf
      /* console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      console.log('error: ' + error);
      console.log(`sTB just saved using asciidoctor-pdf to ${getPdfPathToWrite}`)
      });  */


      console.log( `sTB about to return from saveToBackend `)
      return;

    }
}
