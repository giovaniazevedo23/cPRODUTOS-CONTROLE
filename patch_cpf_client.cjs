const fs = require('fs');
let lines = fs.readFileSync('src/App.jsx', 'utf8').split('\r\n');

let targetLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("if (loginForm.name && loginForm.cnpj && loginForm.phone && loginForm.email) {")) {
    targetLine = i;
    break;
  }
}

if (targetLine !== -1) {
  const insertLines = [
    "        const custRefCheck = doc(db, 'customers', cpfClean);",
    "        const custSnapCheck = await getDoc(custRefCheck);",
    "        if (custSnapCheck.exists()) {",
    "          alert('Esse CPF já está vinculado a outro cadastro.');",
    "          return;",
    "        }"
  ];
  lines.splice(targetLine + 1, 0, ...insertLines);
  fs.writeFileSync('src/App.jsx', lines.join('\r\n'), 'utf8');
  console.log('Inserted CPF uniqueness check in client at line', targetLine + 1);
} else {
  console.log('Target line not found in client app.');
}
