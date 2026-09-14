const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add states for attachments
if (!content.includes('const [supportAttachment')) {
  content = content.replace(
    "const [supportMessage, setSupportMessage] = useState('');",
    "const [supportMessage, setSupportMessage] = useState('');\r\n  const [supportAttachment, setSupportAttachment] = useState(null);\r\n  const [chatAttachment, setChatAttachment] = useState(null);"
  );
}

// 2. Modify handleSendInternalMessage to include chatAttachment
content = content.replace(
  /text: internalChat\.msg,\r?\n\s*date: new Date\(\)\.toISOString\(\)/g,
  "text: internalChat.msg,\n        attachment: chatAttachment,\n        date: new Date().toISOString()"
);

// Reset chatAttachment on send
content = content.replace(
  "setInternalChat(prev => ({ ...prev, msg: '' }));",
  "setInternalChat(prev => ({ ...prev, msg: '' }));\n      setChatAttachment(null);"
);

// Add UI for chat attachment
content = content.replace(
  /onChange=\{e => setInternalChat\(\{\.\.\.internalChat, msg: e\.target\.value\}\)\}\r?\n\s*style=\{\{ flex: 1, padding: '0\.75rem', borderRadius: '2rem', border: '1px solid #ccc' \}\}\r?\n\s*\/>/g,
  "onChange={e => setInternalChat({...internalChat, msg: e.target.value})}\n                style={{ flex: 1, padding: '0.75rem 2.5rem 0.75rem 0.75rem', borderRadius: '2rem', border: '1px solid #ccc' }}\n              />\n              <label style={{ position: 'absolute', right: '90px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#666', marginTop: '12px' }}>\n                <input type=\"file\" accept=\"image/*\" style={{ display: 'none' }} onChange={(e) => {\n                  const file = e.target.files[0];\n                  if (file) {\n                    const reader = new FileReader();\n                    reader.onloadend = () => setChatAttachment(reader.result);\n                    reader.readAsDataURL(file);\n                  }\n                }} />\n                <span style={{ fontSize: '1.2rem', color: chatAttachment ? 'var(--primary-color)' : 'inherit' }}>📎</span>\n              </label>"
);

// 3. Modify Support Modal
// Inject Auto-reply email and attachment logic
content = content.replace(
  /html_message: `<p><strong>Cliente:<\/strong> \$\{customerInfo\?\.name\}<\/p><p><strong>CPF:<\/strong> \$\{customerInfo\?\.cpf\}<\/p><p><strong>Email:<\/strong> \$\{customerInfo\?\.email \|\| 'Não informado'\}<\/p><p><strong>Mensagem:<\/strong><br\/>\$\{supportMessage\}<\/p>`/,
  "html_message: `<p><strong>Cliente:</strong> ${customerInfo?.name}</p><p><strong>CPF:</strong> ${customerInfo?.cpf}</p><p><strong>Email:</strong> ${customerInfo?.email || 'Não informado'}</p><p><strong>Mensagem:</strong><br/>${supportMessage}</p>` + (supportAttachment ? `<br/><p><strong>Anexo:</strong></p><img src=\"${supportAttachment}\" style=\"max-width:100%; max-height:400px;\" />` : '')"
);

// Add the auto-reply email block
const autoReplyLogic = `
                // Envio do e-mail automático para o cliente (Protocolo)
                if (customerInfo?.email) {
                  const protocolo = Math.floor(100000 + Math.random() * 900000);
                  const autoReplyHtml = \`
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #007bff; margin: 0; font-size: 28px;">GESTE</h1>
                      </div>
                      <p>Olá, \${customerInfo.name || 'Cliente'}, recebemos sua mensagem.</p>
                      <p>Este é o seu número de protocolo de atendimento: <strong>#\${protocolo}</strong>.</p>
                      <p>Os documentos e processos que você enviou já estão sendo analisados.</p>
                      <p>Dentro de alguns instantes alguém da nossa equipe vai responder. Fique atento(a) à sua caixa de entrada para as próximas 72 horas.</p>
                      <p style="margin-top: 30px;">Atenciosamente,<br/><strong>Equipe de Suporte GESTE</strong></p>
                    </div>
                  \`;
                  
                  await emailjs.send(
                    'service_n2k30o9',
                    'template_tht2nks',
                    {
                      to_email: customerInfo.email,
                      subject: \`Recebemos sua solicitação - Protocolo #\${protocolo}\`,
                      html_message: autoReplyHtml
                    },
                    { publicKey: 'mNLHg4WMPI_KmzA8c' }
                  ).catch(e => console.error("Erro no auto-reply", e));
                }
`;

content = content.replace(
  "alert(\"Mensagem enviada com sucesso! Entraremos em contato em breve.\");",
  autoReplyLogic + "\n                alert(\"Mensagem enviada com sucesso! Um e-mail com o protocolo foi enviado para você.\");\n                setSupportAttachment(null);"
);

// Add UI for Support Modal Attachment
content = content.replace(
  /<textarea\s+required\s+placeholder="Descreva aqui a sua dúvida, sugestão ou problema\.\.\."\s+value=\{supportMessage\}\s+onChange=\{\(e\) => setSupportMessage\(e\.target\.value\)\}\s+style=\{\{ width: '100%', minHeight: '120px', padding: '0\.75rem', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' \}\}\s+\/>/g,
  `<textarea \n                  required\n                  placeholder="Descreva aqui a sua dúvida, sugestão ou problema..."\n                  value={supportMessage}\n                  onChange={(e) => setSupportMessage(e.target.value)}\n                  style={{ width: '100%', minHeight: '120px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' }}\n                />\n                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center' }}>\n                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: supportAttachment ? 'var(--primary-color)' : 'var(--text-secondary)' }}>\n                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {\n                      const file = e.target.files[0];\n                      if (file) {\n                        if (file.size > 2 * 1024 * 1024) return alert('O arquivo deve ter no máximo 2MB');\n                        const reader = new FileReader();\n                        reader.onloadend = () => setSupportAttachment(reader.result);\n                        reader.readAsDataURL(file);\n                      }\n                    }} />\n                    <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>📎</span>\n                    {supportAttachment ? 'Imagem anexada com sucesso (Clique para trocar)' : 'Anexar uma imagem/comprovante'}\n                  </label>\n                </div>`
);

// We need to render the attachment in the chat messages loop
content = content.replace(
  /\{m\.text\}\r?\n\s*<\/div>/g,
  "{m.text}\n                        </div>\n                        {m.attachment && <div style={{ marginTop: '0.5rem' }}><img src={m.attachment} alt=\"Anexo\" style={{ maxWidth: '100%', borderRadius: '4px', maxHeight: '200px' }} /></div>}"
);

fs.writeFileSync('src/App.jsx', content, 'utf8');
console.log('Client app patched with attachments and auto-reply.');
