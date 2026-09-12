import React, { useState, useEffect } from 'react';
import './App.css';

import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const mockCompanies = [
  { cnpj: '11.111.111/0001-11', name: 'Nazária LTDA' },
  { cnpj: '22.222.222/0001-22', name: 'Tech Solutions' },
  { cnpj: '33.333.333/0001-33', name: 'GigaByte Informática' }
];

const getStatusConfig = (quantity) => {
  if (quantity === 0) return { label: 'Sem Estoque', color: 'var(--danger)', bg: '#fef2f2' };
  if (quantity <= 5) return { label: 'Estoque Crítico', color: 'var(--danger)', bg: '#fef2f2' };
  if (quantity <= 15) return { label: 'Estoque Baixo', color: 'var(--warning)', bg: '#fffbeb' };
  return { label: 'Em Estoque', color: 'var(--success)', bg: '#ecfdf5' };
};

function App() {
  const [customerInfo, setCustomerInfo] = useState(() => JSON.parse(localStorage.getItem('vitrine_customer')) || null);
  const [loginForm, setLoginForm] = useState({ name: '', cnpj: '', phone: '' });
  
  const [catalog, setCatalog] = useState([]);
  
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('vitrine_cart')) || []);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState('PIX');

  const [purchaseItem, setPurchaseItem] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
      const itemsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCatalog(itemsList);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (customerInfo) localStorage.setItem('vitrine_customer', JSON.stringify(customerInfo));
  }, [customerInfo]);

  useEffect(() => {
    localStorage.setItem('vitrine_cart', JSON.stringify(cart));
  }, [cart]);

  const handleLogin = (e) => {
    e.preventDefault();
    setCustomerInfo(loginForm);
  };

  const handleCompanyChange = (e) => {
    setLoginForm({ ...loginForm, cnpj: e.target.value });
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    setLoginForm({ ...loginForm, phone: value });
  };

  const confirmAddToCart = () => {
    if (!purchaseItem) return;
    const existing = cart.find(c => c.sku === purchaseItem.sku);
    if (existing) {
      setCart(cart.map(c => c.sku === purchaseItem.sku ? { ...c, cartQuantity: c.cartQuantity + purchaseQuantity } : c));
    } else {
      setCart([...cart, { ...purchaseItem, cartQuantity: purchaseQuantity }]);
    }
    setPurchaseItem(null);
    setIsCartOpen(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    const total = cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0);
    
    const deal = {
      id: Date.now().toString(),
      client: customerInfo.name,
      phone: customerInfo.phone,
      salesperson: "Vitrine Web",
      title: `Pedido pelo Site (${checkoutMethod})`,
      value: total,
      products: cart.map(c => ({ sku: c.sku, name: c.name, quantity: c.cartQuantity, price: c.price })),
      status: 'Prospecção',
      date: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'deals', deal.id), deal);
      
      let text = `*NOVO PEDIDO DA VITRINE*%0A`;
      text += `*Cliente:* ${customerInfo.name}%0A`;
      text += `*Telefone:* ${customerInfo.phone}%0A`;
      text += `*Método de Pagamento:* ${checkoutMethod}%0A%0A`;
      text += `*Itens:*%0A`;
      cart.forEach(c => {
        text += `- ${c.cartQuantity}x ${c.name} (R$ ${c.price.toFixed(2)})%0A`;
      });
      text += `%0A*TOTAL: R$ ${total.toFixed(2)}*%0A`;

      alert(`Pedido finalizado com sucesso! Seu pedido já está no sistema da loja.`);
      window.open(`https://wa.me/5586998113557?text=${text}`, '_blank');
      
      setCart([]);
      setIsCartOpen(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar pedido.');
    }
  };

  if (!customerInfo) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', display: 'flex' }}>
        <div className="modal-content glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Bem-vindo à Loja</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Identifique-se para acessar o catálogo de produtos.</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>CNPJ da Empresa (Fornecedor)</label>
              <select 
                required 
                value={loginForm.cnpj}
                onChange={handleCompanyChange}
              >
                <option value="">Selecione uma empresa...</option>
                {mockCompanies.map(comp => (
                  <option key={comp.cnpj} value={comp.cnpj}>{comp.name} - {comp.cnpj}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Seu Nome (Comprador)</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: João Silva"
                value={loginForm.name}
                onChange={e => setLoginForm({...loginForm, name: e.target.value})}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Seu WhatsApp</label>
              <input 
                type="text" 
                required 
                placeholder="(00) 00000-0000"
                value={loginForm.phone}
                onChange={handlePhoneChange}
                maxLength="15"
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>
              Acessar Catálogo
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Vitrine de Produtos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{customerInfo.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acessando loja: {customerInfo.cnpj}</div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('vitrine_customer');
              setCustomerInfo(null);
            }} 
            style={{
              background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
              borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '0.85rem'
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="main-content" style={{ marginTop: '2rem' }}>
        <div className="toolbar glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Produtos Disponíveis</h2>
          <button className="btn-secondary" onClick={() => setIsCartOpen(true)} style={{ position: 'relative' }}>
            🛒 Ver Carrinho
            {cart.length > 0 && (
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary-color)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                {cart.reduce((a,c) => a + c.cartQuantity, 0)}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {catalog.map(item => {
            const status = getStatusConfig(item.quantity);
            return (
              <div key={item.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '100%', height: '150px', background: 'var(--background-color)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                  📦
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SKU: {item.sku}</div>
                <div>
                  <h3 style={{ margin: '0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{item.name}</h3>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '0.5rem' }}>R$ {item.price.toFixed(2)}</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Em estoque</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{item.quantity} und</div>
                  </div>
                  <div style={{ 
                    background: status.bg, 
                    color: status.color, 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '1rem',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {status.label}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => { setPurchaseItem(item); setPurchaseQuantity(1); }}
                    disabled={item.quantity === 0}
                  >
                    {item.quantity > 0 ? '🛒 Comprar' : 'Esgotado'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modal de Quantidade */}
      {purchaseItem && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Quantidade: {purchaseItem.name}</h2>
              <button className="close-btn" onClick={() => setPurchaseItem(null)}>×</button>
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <label>Estoque disponível: {purchaseItem.quantity}</label>
              <input 
                type="number" 
                min="1" 
                max={purchaseItem.quantity}
                value={purchaseQuantity}
                onChange={e => {
                  let val = Number(e.target.value);
                  if (val > purchaseItem.quantity) val = purchaseItem.quantity;
                  if (val < 1) val = 1;
                  setPurchaseQuantity(val);
                }}
                style={{ fontSize: '2rem', textAlign: 'center', padding: '1rem', width: '100px', margin: '0 auto', display: 'block' }}
              />
            </div>
            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-secondary" onClick={() => setPurchaseItem(null)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={confirmAddToCart}>🛒 Adicionar ao Carrinho</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal do Carrinho */}
      {isCartOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>🛒 Seu Carrinho</h2>
              <button className="close-btn" onClick={() => setIsCartOpen(false)}>×</button>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {cart.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>O carrinho está vazio.</p>
              ) : (
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Produto</th>
                      <th style={{ padding: '0.5rem' }}>Qtd</th>
                      <th style={{ padding: '0.5rem' }}>Subtotal</th>
                      <th style={{ padding: '0.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{c.name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{c.cartQuantity}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>R$ {(c.price * c.cartQuantity).toFixed(2)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setCart(cart.filter(item => item.sku !== c.sku))}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {cart.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span style={{ color: 'var(--primary-color)' }}>R$ {cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0).toFixed(2)}</span>
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Forma de Pagamento</label>
                  <select value={checkoutMethod} onChange={e => setCheckoutMethod(e.target.value)}>
                    <option value="PIX">PIX (5% Desconto)</option>
                    <option value="Cartão de Crédito">Cartão de Crédito (Até 12x)</option>
                    <option value="Boleto">Boleto Bancário</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={() => setCart([])}>Esvaziar Carrinho</button>
              <button className="btn-primary" onClick={handleCheckout} disabled={cart.length === 0} style={{ gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                Finalizar via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
