import fs from 'node:fs'
import ts from 'typescript'

for (const filename of process.argv.slice(2)) {
  const source = fs.readFileSync(filename, 'utf8')
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  const formatted = printer.printFile(file)
    .replaceAll('<Routes><Route', '<Routes>\n<Route')
    .replaceAll('/><Route', '/>\n<Route')
    .replaceAll('/></Routes>', '/>\n</Routes>')
  fs.writeFileSync(filename, formatted)
}
