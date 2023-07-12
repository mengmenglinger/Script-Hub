// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: cloud-download-alt;
let ToolVersion = "1.21";
async function delay(milliseconds) {
  var before = Date.now();
  while (Date.now() < before + milliseconds) {};
  return true;
}
function convertToValidFileName(str) {
  // 替换非法字符为下划线
  const invalidCharsRegex = /[\/:*?"<>|]/g;
  const validFileName = str.replace(invalidCharsRegex, '_');

  // 删除多余的点号
  const multipleDotsRegex = /\.{2,}/g;
  const fileNameWithoutMultipleDots = validFileName.replace(multipleDotsRegex, '.');

  // 删除文件名开头和结尾的点号和空格
  const leadingTrailingDotsSpacesRegex = /^[\s.]+|[\s.]+$/g;
  const finalFileName = fileNameWithoutMultipleDots.replace(leadingTrailingDotsSpacesRegex, '');

  return finalFileName;
}

function addLineAfterLastOccurrence(text, addition) {
  const regex = /^#!.*$/gm;
  const matchArray = text.match(regex);
  const lastIndex = matchArray ? matchArray.length - 1 : -1;
  
  if (lastIndex >= 0) {
    const lastMatch = matchArray[lastIndex];
    const insertIndex = text.indexOf(lastMatch) + lastMatch.length;
    const newText = text.slice(0, insertIndex) + addition + text.slice(insertIndex);
    return newText;
  }
  
  return text;
}

let idx
let fromUrlScheme
// if (args.queryParameters.url && args.queryParameters.name) {
if (args.queryParameters.url) {
  fromUrlScheme = true
}
if (fromUrlScheme) {
  idx = 2
} else {
  let alert = new Alert()
    alert.title = "Surge 模块工具"
  //alert.addDestructiveAction("更新文件夹内全部文件")
  alert.addAction("更新全部模块")
  alert.addAction("更新单个模块")
  alert.addAction("从链接创建")
  alert.addDestructiveAction("更新本脚本")
  alert.addCancelAction("取消")
  idx = await alert.presentAlert()
}



let folderPath
let files = []
let contents = []
const fm = FileManager.iCloud()
if (idx == 0) {
  folderPath = await DocumentPicker.openFolder()
  files = fm.listContents(folderPath)
} else if (idx == 1) {
  const filePath = await DocumentPicker.openFile()
  folderPath = filePath.substring(0, filePath.lastIndexOf('/'))
  files = [filePath.substring(filePath.lastIndexOf('/')+1)]
} else if (idx == 2) {
  let url
  let name
  if (fromUrlScheme) {
    url = args.queryParameters.url
    name = args.queryParameters.name
  } else {
    alert = new Alert()
    alert.title = '将自动添加后缀 .sgmodule'
    alert.addTextField('名称(选填)', '')
    alert.addTextField('链接(必填)', '')
    alert.addAction("下载")
    alert.addCancelAction("取消")
    await alert.presentAlert()
    url = alert.textFieldValue(1)
    name = alert.textFieldValue(0)
  }
  if (url) {
    if (!name) {
      const plainUrl = url.split('?')[0]
      const fullname = plainUrl.substring(plainUrl.lastIndexOf('/')+1)
      if (fullname) {
        name = fullname.replace(/\.sgmodule$/, '')  
      }
      if (!name) {
        name = `untitled-${new Date().toLocaleString()}`
      }
    }
    name = convertToValidFileName(name)
    files = [`${name}.sgmodule`]
    contents = [`#SUBSCRIBED ${url}`]
  }
} else if (idx == 3) {
  console.log("更新")
   await update()
}




for await (const [index, file] of files.entries()) {
  if (file && !/\.(conf|txt|js|list)$/i.test(file)) {
    // console.log(file);
    let originalName
    let originalDesc
    try {
      let content
      let filePath
      if (contents.length > 0) {
        content = contents[index]
      } else {
        filePath = `${folderPath}/${file}`
        content = fm.readString(filePath)
        
      }
      const matched = `${content}`.match(/^#SUBSCRIBED\s+(.*?)\s*(\n|$)/im)
      if (!matched) {
        throw new Error('无订阅链接')
      }
      const subscribed = matched[0]
      const url = matched[1]
      if (!url) {
        throw new Error('无订阅链接')
      }

      const originalNameMatched = `${content}`.match(/^#\!name\s*?=\s*(.*?)\s*(\n|$)/im)
      if (originalNameMatched) {
        originalName = originalNameMatched[1]
      }
      const originalDescMatched = `${content}`.match(/^#\!desc\s*?=\s*(.*?)\s*(\n|$)/im)
      if (originalDescMatched) {
        originalDesc = originalDescMatched[1]
        if (originalDesc) {
          originalDesc = originalDesc.replace(/^🔗.*?]\s*/i, '')
        }
      }

      const req = new Request(url);
      req.timeoutInterval = 10;
      req.method = 'GET';
      let res = await req.loadString();
      const statusCode = req.response.statusCode
      if (statusCode < 200 || statusCode >= 400) {
        throw new Error(`statusCode: ${statusCode}`)
      }
      if (!res) {
        throw new Error(`未获取到模块内容`)
      }

      const nameMatched = `${res}`.match(/^#\!name\s*?=\s*?\s*(.*?)\s*(\n|$)/im)
      if (!nameMatched) {
        throw new Error(`不是合法的模块内容`)
      }
      const name = nameMatched[1]
      if (!name) {
        throw new Error('模块无名称字段')
      }
      const descMatched = `${res}`.match(/^#\!desc\s*?=\s*?\s*(.*?)\s*(\n|$)/im)
      let desc
      if (descMatched) {
        desc = descMatched[1]
      }
      if (!desc) {
        res = `#!desc=\n${res}`
      }
      // console.log(res);
      res = addLineAfterLastOccurrence(res, `\n\n# 🔗 模块链接\n${subscribed.replace(/\n/g, "")}\n`)
      content = `${res}`.replace(/^#\!desc\s*?=\s*/mi, `#!desc=🔗 [${new Date().toLocaleString()}] `)
      // console.log(content);
      if (filePath) {
        fm.writeString(filePath, content)  
      } else {
        await DocumentPicker.exportString(content, file);
      }
      
      // }
      let nameInfo = `${name}`
      let descInfo = `${desc}`
      if (originalName && name !== originalName) {
        nameInfo = `${originalName} -> ${name}`
      }
      if (originalDesc && desc !== originalDesc) {
        descInfo = `${originalDesc} -> ${desc}`
      }
      console.log(`\n✅ ${nameInfo}\n${descInfo}\n${file}`);
      await delay(1 * 1000)
      if (fromUrlScheme) {
        alert = new Alert()
        alert.title = `✅ ${nameInfo}`
        alert.message = `${descInfo}\n${file}`
        alert.addAction("打开 Surge")
        alert.addCancelAction("关闭")
        idx = await alert.presentAlert()
        if (idx == 0) {
          Safari.open('surge://')
        }
      }
    } catch (e) {
      console.log(`\n❌ ${originalName || ''}\n${file}`);
      console.error(e);
      if (fromUrlScheme) {
        alert = new Alert()
        alert.title = `❌ ${originalName || ''}\n${file}`
        alert.message = `${e.message || e}`
        alert.addCancelAction("关闭")
        await alert.presentAlert()
      }
    }
  }
}

// @key Think @wuhu.
async function update() {
  const fm = FileManager.iCloud()
  const dict = fm.documentsDirectory()
  // const scriptName = Script.name()
  const scriptName = "SurgeModuleTool"
  const url = "https://raw.githubusercontent.com/Script-Hub-Org/Script-Hub/main/SurgeModuleTool.js"
  let req = new Request(url)
  req.method = "GET"
  const resp = await req.loadString()
  
  const regex = /let ToolVersion = "([\d.]+)"/
  const match = resp.match(regex);
  const version = (match ? match[1] : "")
  
  if (version > ToolVersion) {
      fm.writeString(`${dict}/${scriptName}.js`, resp)
      let notification = new Notification()
      notification.title = "脚本更新成功Version:"+version
      notification.subtitle = "点击该通知即可跳转"
      notification.sound = "default"
      notification.openURL = `scriptable:///open/${scriptName}`
      notification.addAction("打开脚本", `scriptable:///open/${scriptName}`, false)
      await notification.schedule()
  } else {
      let alert = new Alert()
      alert.title = "Surge 模块工具 已是\n最新版本 Version:"+version
      alert.addCancelAction("完成")
      await alert.presentAlert()
  }
}