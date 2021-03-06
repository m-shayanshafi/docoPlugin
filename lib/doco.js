'use babel';

import DocoView from './doco-view';
import { CompositeDisposable } from 'atom';
import {exec, execSync} from 'child_process';
const path = require('path');
var Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
var readline = require('readline');
var stream = require('stream');
var dir = require('node-dir');



export default {

  docoView: null,
  modalPanel: null,
  subscriptions: null,

  // "jpf_home": "../jpf-core/",
  // "jvm_flags": "-Xmx1024m -ea",
  // "classpath": ["../guava/guava/target/classes", "/home/minh/.m2/repository/org/checkerframework/checker-compat-qual/2.0.0/checker-compat-qual-2.0.0.jar"],
  // "tests_dir": "/opt/guava/guava-tests/test"

  config: {
    "jpf_home": {
      "description": "Home for JPF",
      "type": "string",
      "default": ""
    },
    "jvm_flags": {
      "description": "JVM Flags",
      "type": "string",
      "default": "-Xmx1024m -ea"
    },
    "classpath": {
      "description": "Class Path for files",
      "type": "array",
      "default": []
    },
    "daikon_classpath": {
      "description": "Class Path for Daikon runtime",
      "type": "array",
      "default": []
    },
    "test_file": {
      "description": "Test file",
      "type": "string",
      "default": ""
    },
    "path_to_doco": {
      "description": "Path to doco",
      "type": "string",
      "default": ""
    },
    "max_depth": {
      "description": "Maximum depth for JDart",
      "type": "integer",
      "default": 42
    }
  },

  activate(state) {
    this.docoView = new DocoView(state.docoViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.docoView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'doco:generateDoc': () => this.generateDoc()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.docoView.destroy();
  },

  serialize() {
    return {
      docoViewState: this.docoView.serialize()
    };
  },

  generateDoc() {

    console.log('Doco was toggled!');
    // console.log(atom.packages.getPackageDirPaths())

    let packageDirectory = atom.packages.getPackageDirPaths()[0] + '/doco'
    let docoPath = atom.config.get('doco.path_to_doco')
    
    // let [projectPath, relativePath] = atom.project.relativizePath(@buffer.file.path)
    let projectDirList = atom.project.getPaths()



    // console.log(projectDir)

    // Selecting a function and generating documentation for it
    // get the cursor position
    // keep going above until you find the matching function declaration

    let editor = atom.workspace.getActiveTextEditor()
    if (editor) {

      let thisFile = editor.getPath()
      let projectDir = ""
      for (var i = 0; i < projectDirList.length; i++) {
        if(thisFile.includes(projectDirList[i])){
          projectDir = projectDirList[i]
        }
      }

      console.log(projectDir)

      let curPos = editor.getCursorBufferPosition()
      let buffer = editor.getBuffer()
      let thisLine = buffer.lineForRow(curPos.row)
      // console.log(thisLine)
      let funcRegex = /(public|protected|private|static|public\sstatic \s) +[\w\<\>\[\]]+\s+(\w+) *\([^\)]*\) *(\{?|[^;])/
      let funcString = ""

      let classString = ""
      let packageString = ""
      let docGenerated = false
      let funcDetected = false
      let classDetected = false
      let packageDetected = false
      let documentationStartsAt = -1
      let documentationEndsAt = -1
      let funcAt = -1
      let whitespacePrefix = ""

      while(curPos.row > 0 && (thisLine.match(funcRegex)==null)){
        curPos.row= curPos.row - 1
        thisLine = buffer.lineForRow(curPos.row)
      }

      if(curPos.row == 0 && (thisLine.match(funcRegex)==null)){
        console.log("Error: Cursor not in function")
      }else{
        funcString = thisLine
        funcAt = curPos.row
        funcDetected = true;
        whitespacePrefix = funcString.substring(0, funcString.search(/\S/))
        let lineaboveFunction = buffer.lineForRow(curPos.row - 1)
        if (lineaboveFunction != null && /^\s*\/\/ #doco-end/.test(lineaboveFunction)) {
          documentationEndsAt = curPos.row - 1
          let row = documentationEndsAt
          let line = null
          while (typeof(line = buffer.lineForRow(row)) != 'undefined') {
            if (/^\s*$/.test(line)) {
              row -= 1
              continue
            }
            if (/^\s*\/\/ #doco-start/.test(line)) {
              documentationStartsAt = row
              break
            }
            if (!/^\s*\/\//.test(line)) {
              break
            }
            row -= 1
          }
          docGenerated = documentationStartsAt >= 0
        }
      }

      let classRegex = /.*class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+(\w|,)+)?\s*.*/

      while(curPos.row > 0 && (thisLine.match(classRegex)==null)){
        curPos.row = curPos.row - 1
        thisLine = buffer.lineForRow(curPos.row)
        // console.log(thisLine)
      }
      if(curPos.row == 0 && (thisLine.match(funcRegex)==null)){
        console.log("Error: Can't find className")
      }else{
        classString = thisLine
        classDetected = true;
        // console.log(classString)
      }

      let packageRegex = /.*package\s+(\w.+)/

      while(curPos.row > 0 && (thisLine.match(packageRegex)==null)){
        curPos.row = curPos.row - 1
        thisLine = buffer.lineForRow(curPos.row)
        // console.log(thisLine)
      }

      if(curPos.row == 0 && (thisLine.match(packageRegex)==null)){
        console.log("Error: Can't find packageName")
      }else{
        packageString = thisLine
        packageDetected = true;
      }

      // console.log(funcString)
      // console.log(classString)
      // console.log(packageString)
      funcString = funcString.replace(/\s+{/,"");
      console.log(funcString)
      classString = classString.replace(/.*class\s+/,"")
      classString = classString.replace(/{/,"");
      classString = classString.replace(/ .*/,'');
      console.log(classString)
      packageString = packageString.replace(/.*package\s+/,"")
      packageString = packageString.replace(/;/,"")
      console.log(packageString)

      if (docGenerated) {
        buffer.deleteRows(documentationStartsAt, documentationEndsAt)
      } else if (!docGenerated && funcDetected && classDetected && packageDetected) {
        let config = atom.config.get('doco')
        let commandtoRun = docoPath + " '" + JSON.stringify(config) + "' '" + packageString + "' '" + classString + "' '" + funcString + "' '" + config.test_file + "'"

        let notif = atom.notifications.addInfo("Invoking Doco")
        setTimeout(function() {
          let stdout = execSync(commandtoRun).toString()
          let global = {"pre":[], "post":[]}
          let conds = []
          let matches = null
          if (matches = stdout.match(/^#doco-jpf .*$/m)) {
            global.pre.push(matches[0].substring(10))
          }
          let daikonRegex = /^#doco-daikon .*$/gm
          while (matches = daikonRegex.exec(stdout)) {
            let result = JSON.parse(matches[0].substring(13))
            if (result.cond.length == 0) {
              global.pre.push(...result.pre)
              global.post.push(...result.post)
            } else {
              conds.push(result)
            }
          }
          let lines = []
          if (global.pre.length > 0 || global.post.length > 0 || conds.length > 0) {
            /* the generated documentation will look like the following
             * // #doco-start
             * // Global
             * // - Preconditions: (n > 2) && (this.arr.length > 0)
             * // - Postconditions: this.arr.length does not change
             * // When a > 0
             * // - Preconditions: (n <= 2) && (this.arr.length > 10)
             * // - Postconditions: this.arr.length == orig(this.arr.length + 1)
             * // #doco-end
             */
            lines.push(whitespacePrefix + "// #doco-start")
            if (global.pre.length > 0 || global.post.length > 0) {
              lines.push(whitespacePrefix + "// Global")
              if (global.pre.length > 0) {
                lines.push(whitespacePrefix + "// - Preconditions:")
                for (let i = 0; i < global.pre.length; i++) {
                  lines.push(whitespacePrefix + "//     " + global.pre[i])
                }
              }
              if (global.post.length > 0) {
                lines.push(whitespacePrefix + "// - Postconditions:")
                for (let i = 0; i < global.post.length; i++) {
                  lines.push(whitespacePrefix + "//     " + global.post[i])
                }
              }
            }
            for (let i = 0; i < conds.length; i++) {
              lines.push(whitespacePrefix + "// When " + conds[i].cond)
              if (conds[i].pre.length > 0) {
                lines.push(whitespacePrefix + "// - Preconditions:")
                for (let j = 0; j < conds[i].pre.length; j++) {
                  lines.push(whitespacePrefix + "//     " + conds[i].pre[j])
                }
              }
              if (conds[i].post.length > 0) {
                lines.push(whitespacePrefix + "// - Postconditions:")
                for (let j = 0; j < conds[i].post.length; j++) {
                  lines.push(whitespacePrefix + "//     " + conds[i].post[j])
                }
              }
            }
            lines.push(whitespacePrefix + "// #doco-end")
          }
          notif.dismiss()
          if (lines.length > 0) {
            buffer.setTextInRange([[funcAt, 0], [funcAt, 0]], lines.join("\n") + "\n", {normalizeLineEndings: true})
          } else {
            atom.notifications.addInfo("Doco did not find any useful documentation")
          }
        }, 250)
      }
    }
  }
};


async function runCommand(cmd) {
  let std = await new Promise(function (resolve, reject) {
    exec(cmd, {}, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
  return std
}


function iterate(dir) {
  return fs.readdirAsync(dir).map(function(file) {
    file = path.resolve(dir, file);
    return fs.statAsync(file).then(function(stat) {
      if (stat.isDirectory()) {
        return iterate(file);
      }
    })
  }).then(function(results) {
    // flatten the array of arrays
    console.log(results)
    return Array.prototype.concat.apply([], results);
  });

}

function readFile(file){
  let lineReader = require('readline').createInterface({
    input: fs.createReadStream(file)
  });

  lineReader.on('line', function (line) {
    // console.log('Line from file:', line);
    return "Hello";
  });
}

function readFiles(dirname, onFileContent, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    filenames.forEach(function(filename) {
      fs.readFile(dirname + filename, 'utf-8', function(err, content) {
        if (err) {
          onError(err);
          return;
        }
        onFileContent(filename, content);
      });
    });
  });
}
