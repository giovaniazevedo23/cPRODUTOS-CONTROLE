import React, { useState, useEffect, useRef } from 'react';
import './App.css';

import { collection, query, where, onSnapshot, getDoc, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import logo from './assets/logo.jpg';
import { db } from './firebase';

const getStatusConfig = (quantity) => {
  if (quantity <= 0) return { label: 'Esgotado', color: 'var(--danger)', bg: '#fef2f2' };
  if (quantity <= 15) return { label: 'Disponível', color: 'var(--warning)', bg: '#fffbeb' };
  return { label: 'Em Estoque', color: 'var(--success)', bg: '#ecfdf5' };
};

function Countdown({ endsAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'bold' }}>
      <span style={{ background: '#333', color: 'white', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{h}</span>
      <span style={{ color: '#333' }}>:</span>
      <span style={{ background: '#333', color: 'white', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{m}</span>
      <span style={{ color: '#333' }}>:</span>
      <span style={{ background: '#333', color: 'white', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{s}</span>
    </div>
  );
}

function App() {
  const [customerInfo, setCustomerInfo] = useState(() => JSON.parse(localStorage.getItem('vitrine_customer')) || null);
  const [loginMode, setLoginMode] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ name: '', cnpj: '', phone: '', cpf: '' });
  
  const [catalog, setCatalog] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deals, setDeals] = useState([]);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('vitrine_cart')) || []);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState('PIX');
  
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ salesperson: '', stars: 5, comment: '' });
  const [viewingProfile, setViewingProfile] = useState(null); // Vendedor
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ birthday: '', address: '', neighborhood: '', zip: '', city: '', state: '' });
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showMeusPedidosModal, setShowMeusPedidosModal] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeTab, setActiveTab] = useState('produtos'); // produtos, ofertas, cupons
  const [viewingDeal, setViewingDeal] = useState(null);

  // Módulo de Pagamento com Cartão
  const [savedCards, setSavedCards] = useState(() => JSON.parse(localStorage.getItem('vitrine_saved_cards')) || []);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCardCheckout, setShowCardCheckout] = useState(false);
  const [showMpCardForm, setShowMpCardForm] = useState(false);
  const [isMpFormMounted, setIsMpFormMounted] = useState(false);
  const mpCardFormRef = useRef(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [installments, setInstallments] = useState(1);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', holder: '', expiry: '', cvv: '', type: 'credit' });
  const [showAddCardForm, setShowAddCardForm] = useState(false);

  const [pixPayment, setPixPayment] = useState(null);
  const [isPixLoading, setIsPixLoading] = useState(false);
  const MP_ACCESS_TOKEN = "APP_USR-1632412567821548-091223-e95ce7374f7452b2a4a6935f02930030-1745666103";

  const [viewingProduct, setViewingProduct] = useState(null);
  const [productReviews, setProductReviews] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviewForm, setReviewForm] = useState(null);
  const [sellerReviewForm, setSellerReviewForm] = useState(null);
  const [internalChat, setInternalChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => JSON.parse(localStorage.getItem('vitrine_search_history')) || []);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [viewedProductsHistory, setViewedProductsHistory] = useState(() => JSON.parse(localStorage.getItem('vitrine_viewed_history')) || []);
  const [showViewedHistoryModal, setShowViewedHistoryModal] = useState(false);
  const [showOpinionsModal, setShowOpinionsModal] = useState(false);

  const hasUnreadClient = deals.some(d => {
    if (d.messages && d.messages.length > 0) {
      return d.messages[d.messages.length - 1].role === 'admin';
    }
    return false;
  });

  const hasNfeNotification = customerInfo ? deals.some(d => (d.customerCpf === customerInfo.cpf || d.client === customerInfo.name) && d.nfeNotification) : false;

  const [purchaseItem, setPurchaseItem] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  useEffect(() => {
    if (!customerInfo || !customerInfo.cnpj) {
      const unsubComp = onSnapshot(collection(db, 'companies'), (snap) => {
        setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => { unsubComp(); };
    }

    const itemsQ = query(collection(db, 'items'), where('companyCnpj', '==', customerInfo.cnpj));
    const unsubItems = onSnapshot(itemsQ, (snap) => {
      setCatalog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const dealsQ = query(collection(db, 'deals'), where('companyCnpj', '==', customerInfo.cnpj));
    const unsubDeals = onSnapshot(dealsQ, (snap) => {
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const usersQ = query(collection(db, 'users'), where('companyCnpj', '==', customerInfo.cnpj));
    const unsubUsers = onSnapshot(usersQ, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Reviews can be fetched globally or by company? Let's just fetch all or filter by seller name later,
    // or we can add companyCnpj to reviews too.
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubProductReviews = onSnapshot(collection(db, 'product_reviews'), (snap) => {
      setProductReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubComp = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubCoupons = onSnapshot(query(collection(db, 'coupons'), where('companyCnpj', '==', customerInfo.cnpj)), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubItems(); unsubComp(); unsubDeals(); unsubUsers(); unsubReviews(); unsubProductReviews(); unsubCoupons(); };
  }, [customerInfo]);

  useEffect(() => {
    if (customerInfo) localStorage.setItem('vitrine_customer', JSON.stringify(customerInfo));
  }, [customerInfo]);

  useEffect(() => {
    localStorage.setItem('vitrine_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('vitrine_viewed_history', JSON.stringify(viewedProductsHistory));
  }, [viewedProductsHistory]);

  const handleViewProduct = (item) => {
    setViewingProduct(item);
    setViewedProductsHistory(prev => {
      const filtered = prev.filter(p => p.id !== item.id);
      return [item, ...filtered].slice(0, 10);
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    if (!cpfRegex.test(loginForm.cpf)) {
      alert("Por favor, insira um CPF válido no formato 000.000.000-00");
      return;
    }
    const cpfClean = loginForm.cpf.replace(/\D/g, '');

    if (loginMode === 'login') {
      const custRef = doc(db, 'customers', cpfClean);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        setCustomerInfo(custSnap.data());
      } else {
        alert("Cliente não encontrado. Por favor, crie uma conta.");
      }
    } else {
      if (loginForm.name && loginForm.cnpj && loginForm.phone) {
        const customerObj = {
          name: loginForm.name,
          cpf: loginForm.cpf,
          cnpj: loginForm.cnpj,
          phone: loginForm.phone,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'customers', cpfClean), customerObj);
        setCustomerInfo(customerObj);
        setProfileData({ birthday: '', address: '', neighborhood: '', zip: '', city: '', state: '' });
      }
    }
  };

  // Carregar profile data existente
  useEffect(() => {
    if (customerInfo && customerInfo.cpf) {
      setProfileData({
        birthday: customerInfo.birthday || '',
        address: customerInfo.address || '',
        neighborhood: customerInfo.neighborhood || '',
        zip: customerInfo.zip || '',
        city: customerInfo.city || '',
        state: customerInfo.state || ''
      });
    }
  }, [customerInfo]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!customerInfo) return;
    const cpfClean = customerInfo.cpf.replace(/\D/g, '');
    const updatedCustomer = { ...customerInfo, ...profileData };
    try {
      await updateDoc(doc(db, 'customers', cpfClean), profileData);
      setCustomerInfo(updatedCustomer);
      alert('Perfil atualizado com sucesso!');
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar perfil.');
    }
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

  const handleCpfChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setLoginForm({ ...loginForm, cpf: value });
  };

  const confirmAddToCart = () => {
    if (!purchaseItem) return;
    if (!selectedSalesperson) {
      alert("Por favor, selecione quem lhe atendeu.");
      return;
    }
    const existing = cart.find(c => c.sku === purchaseItem.sku && c.salesperson === selectedSalesperson);
    if (existing) {
      setCart(cart.map(c => (c.sku === purchaseItem.sku && c.salesperson === selectedSalesperson) ? { ...c, cartQuantity: c.cartQuantity + purchaseQuantity } : c));
    } else {
      setCart([...cart, { ...purchaseItem, cartQuantity: purchaseQuantity, salesperson: selectedSalesperson }]);
    }
    setPurchaseItem(null);
    setIsCartOpen(true);
  };

  const finalizeCheckout = async () => {
    if (cart.length === 0) return;
    
    const total = cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0);
    
    const deal = {
      id: Date.now().toString(),
      client: customerInfo.name,
      phone: customerInfo.phone,
      salesperson: cart[0].salesperson || "Vitrine Web",
      title: `Pedido pelo Site (${checkoutMethod})`,
      value: total,
      products: cart.map(c => ({ sku: c.sku, name: c.name, quantity: c.cartQuantity, price: c.price })),
      status: 'Ganho',
      date: new Date().toISOString(),
      companyCnpj: customerInfo.cnpj,
      customerCpf: customerInfo.cpf,
      source: 'vitrine',
      messages: [],
      shippingStatus: 'Recebido',
      paymentMethod: checkoutMethod
    };

    try {
      await setDoc(doc(db, 'deals', deal.id), deal);
      
      // Atualiza os produtos adicionando as quantidades vendidas (sold)
      for (const item of cart) {
        try {
          const itemRef = doc(db, 'items', item.id);
          const itemDoc = await getDoc(itemRef);
          if (itemDoc.exists()) {
            await updateDoc(itemRef, { sold: (itemDoc.data().sold || 0) + item.cartQuantity });
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Atualiza o uso do cupom se aplicável
      if (appliedCoupon) {
        try {
          const couponRef = doc(db, 'coupons', appliedCoupon.id);
          const couponDoc = await getDoc(couponRef);
          if (couponDoc.exists()) {
            await updateDoc(couponRef, { usedCount: (couponDoc.data().usedCount || 0) + 1 });
          }
        } catch (e) { console.error('Erro ao atualizar cupom', e); }
      }

      alert(`Pedido finalizado com sucesso! Seu pedido já está no sistema da loja.`);
      
      setCart([]);
      setIsCartOpen(false);
      setAppliedCoupon(null);
      setCouponInput('');
      setReviewData({ salesperson: cart[0].salesperson, stars: 5, comment: '' });
      setShowReviewModal(true);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar pedido.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (checkoutMethod === 'PIX') {
      setIsPixLoading(true);
      try {
        const total = cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0);
        const response = await fetch('/mp-api/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'X-Idempotency-Key': Date.now().toString()
          },
          body: JSON.stringify({
            transaction_amount: total,
            description: "Pedido GESTE",
            payment_method_id: "pix",
            payer: {
              email: "cliente@suamarca.com"
            }
          })
        });
        
        const data = await response.json();
        if (data.status === 'pending' && data.point_of_interaction) {
          const transData = data.point_of_interaction.transaction_data;
          setPixPayment({
            id: data.id,
            qrCode: transData.qr_code,
            qrCodeBase64: transData.qr_code_base64,
            total: total
          });
        } else {
          alert('Erro ao gerar PIX: ' + (data.message || JSON.stringify(data)));
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao conectar com Mercado Pago.');
      }
      setIsPixLoading(false);
    } else {
      finalizeCheckout();
    }
  };

  useEffect(() => {
    let intervalId;
    if (pixPayment && pixPayment.id) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/mp-api/v1/payments/${pixPayment.id}`, {
            headers: {
              'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            }
          });
          const data = await res.json();
          if (data.status === 'approved') {
            clearInterval(intervalId);
            setPixPayment(null);
            finalizeCheckout();
          } else if (data.status === 'cancelled' || data.status === 'rejected') {
            clearInterval(intervalId);
            setPixPayment(null);
            alert('Pagamento PIX cancelado ou rejeitado.');
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 5000);
    }
    return () => clearInterval(intervalId);
  }, [pixPayment]);

  // ===== Mercado Pago Card SDK =====
  const MP_PUBLIC_KEY = 'APP_USR-d3ac1069-b68c-4bc9-ac8a-45c9993f0e84';

  useEffect(() => {
    if (!showMpCardForm) {
      // Unmount previous form if exists
      if (mpCardFormRef.current) {
        try { mpCardFormRef.current.unmount(); } catch(e) {}
        mpCardFormRef.current = null;
      }
      setIsMpFormMounted(false);
      return;
    }

    const initMPForm = () => {
      if (!window.MercadoPago) {
        setTimeout(initMPForm, 150);
        return;
      }

      const total = cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0);
      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });

      const form = mp.cardForm({
        amount: total.toFixed(2),
        iframe: true,
        style: {
          base: {
            fontSize: '15px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }
        },
        form: {
          id: 'mp-card-form',
          cardNumber: { id: 'mp-card-number', placeholder: '0000 0000 0000 0000' },
          expirationDate: { id: 'mp-expiration-date', placeholder: 'MM/AA' },
          securityCode: { id: 'mp-security-code', placeholder: 'CVV' },
          cardholderName: { id: 'mp-cardholder-name', placeholder: 'Nome como no cartão' },
          issuer: { id: 'mp-issuer', label: 'Bandeira' },
          installments: { id: 'mp-installments', label: 'Parcelas' },
          identificationType: { id: 'mp-identification-type', label: 'Tipo' },
          identificationNumber: { id: 'mp-identification-number', placeholder: 'CPF/CNPJ' },
          cardholderEmail: { id: 'mp-cardholder-email', placeholder: 'Email para recibo' },
        },
        callbacks: {
          onFormMounted: (error) => {
            if (error) { console.warn('MP form mount error:', error); return; }
            setIsMpFormMounted(true);
          },
          onSubmit: async (event) => {
            event.preventDefault();
            setIsCardLoading(true);
            try {
              const { paymentMethodId, issuerId, cardholderEmail, amount, token, installments: inst, identificationNumber, identificationType } = form.getCardFormData();
              const response = await fetch('/mp-api/v1/payments', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                  'X-Idempotency-Key': Date.now().toString()
                },
                body: JSON.stringify({
                  transaction_amount: Number(amount),
                  token,
                  description: 'Pedido GESTE',
                  installments: Number(inst) || installments || 1,
                  payment_method_id: paymentMethodId,
                  issuer_id: issuerId ? Number(issuerId) : undefined,
                  payer: {
                    email: cardholderEmail,
                    identification: { type: identificationType, number: identificationNumber }
                  }
                })
              });
              const data = await response.json();
              if (data.status === 'approved') {
                setShowMpCardForm(false);
                await finalizeCheckout();
              } else if (data.status === 'in_process') {
                alert('Pagamento em análise! Seu pedido será confirmado em breve.');
                setShowMpCardForm(false);
                await finalizeCheckout();
              } else {
                alert('Pagamento não aprovado: ' + (data.status_detail || data.message || 'Verifique os dados e tente novamente.'));
              }
            } catch (err) {
              console.error(err);
              alert('Erro ao processar pagamento. Tente novamente.');
            }
            setIsCardLoading(false);
          },
          onError: (errors) => {
            console.error('MP Card Errors:', errors);
          }
        }
      });

      mpCardFormRef.current = form;
    };

    initMPForm();

    return () => {
      if (mpCardFormRef.current) {
        try { mpCardFormRef.current.unmount(); } catch(e) {}
        mpCardFormRef.current = null;
      }
    };
  }, [showMpCardForm]);

  // ===== Card Management Functions =====
  const formatCardNumber = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const getCardBrand = (number) => {
    const n = number.replace(/\s/g, '');
    if (/^4/.test(n)) return { brand: 'Visa', icon: '💳' };
    if (/^5[1-5]/.test(n)) return { brand: 'Mastercard', icon: '💳' };
    if (/^3[47]/.test(n)) return { brand: 'Amex', icon: '💳' };
    if (/^6/.test(n)) return { brand: 'Elo', icon: '💳' };
    return { brand: 'Cartão', icon: '💳' };
  };

  const handleSaveCard = (e) => {
    e.preventDefault();
    const digits = cardForm.number.replace(/\s/g, '');
    if (digits.length < 16) return alert('Número do cartão inválido.');
    const { brand } = getCardBrand(digits);
    const newCard = {
      id: Date.now().toString(),
      last4: digits.slice(-4),
      brand,
      holder: cardForm.holder,
      expiry: cardForm.expiry,
      type: cardForm.type,
      bin: digits.slice(0, 6),
    };
    const updated = [...savedCards, newCard];
    setSavedCards(updated);
    localStorage.setItem('vitrine_saved_cards', JSON.stringify(updated));
    setCardForm({ number: '', holder: '', expiry: '', cvv: '', type: 'credit' });
    setShowAddCardForm(false);
    alert('Cartão salvo com sucesso!');
  };

  const handleDeleteCard = (id) => {
    if (!window.confirm('Remover este cartão?')) return;
    const updated = savedCards.filter(c => c.id !== id);
    setSavedCards(updated);
    localStorage.setItem('vitrine_saved_cards', JSON.stringify(updated));
  };

  const handleCardCheckout = async () => {
    if (!selectedCard) return alert('Selecione um cartão para continuar.');
    setIsCardLoading(true);
    try {
      const total = cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0);
      const installmentValue = (total / installments).toFixed(2);
      
      // Finaliza o pedido registrando no Firebase sem processar o cartão real por agora
      // (a tokenização real exige SDK do MP que só funciona no frontend com campos PCI-compliant)
      await finalizeCheckout();
      setShowCardCheckout(false);
      setSelectedCard(null);
      setInstallments(1);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar pagamento.');
    }
    setIsCardLoading(false);
  };

  const handleSendInternalMessage = async (e) => {
    e.preventDefault();
    if (!internalChat || !internalChat.msg.trim()) return;

    try {
      const dealRef = doc(db, 'deals', internalChat.dealId);
      const deal = deals.find(d => d.id === internalChat.dealId);
      const currentMessages = deal?.messages || [];
      
      const newMessages = [...currentMessages, {
        sender: customerInfo.name,
        role: 'client',
        text: internalChat.msg,
        date: new Date().toISOString()
      }];

      if (currentMessages.length === 0) {
        newMessages.push({
          sender: 'Sistema',
          role: 'system',
          text: `Abertura do protocolo #${deal.id.slice(-6)} registrada. Você está na fila de atendimento e em breve o(a) atendente ${deal.salesperson || 'atribuído(a)'} irá responder.`,
          date: new Date(Date.now() + 1000).toISOString()
        });
      }

      await updateDoc(dealRef, {
        messages: newMessages
      });
      setInternalChat(prev => ({ ...prev, msg: '' }));
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar mensagem.');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewData.salesperson) return;
    
    const reviewId = Date.now().toString();
    const review = {
      id: reviewId,
      salesperson: reviewData.salesperson,
      client: customerInfo.name,
      stars: Number(reviewData.stars),
      comment: reviewData.comment,
      date: new Date().toISOString()
    };
    
    try {
      await setDoc(doc(db, 'reviews', reviewId), review);
      setShowReviewModal(false);
      alert('Obrigado pela sua avaliação!');
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar avaliação.');
    }
  };

  const handleProductReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.productId || !reviewForm.dealId) return;
    
    const reviewId = Date.now().toString();
    try {
      await setDoc(doc(db, 'product_reviews', reviewId), {
        id: reviewId,
        dealId: reviewForm.dealId,
        productId: reviewForm.productId,
        productName: reviewForm.productName || 'Produto',
        companyCnpj: customerInfo.cnpj,
        customerName: customerInfo.name,
        customerCpf: customerInfo.cpf,
        stars: Number(reviewForm.stars),
        comment: reviewForm.comment,
        photo: reviewForm.photo || '', // base64 placeholder
        date: new Date().toISOString()
      });
      setReviewForm(null);
      alert('Avaliação do produto enviada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar avaliação do produto.');
    }
  };

  const handleSellerReview = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'seller_reviews'), {
        dealId: sellerReviewForm.dealId,
        salesperson: sellerReviewForm.salesperson,
        customerName: customerInfo.name,
        customerCpf: customerInfo.cpf,
        stars: Number(sellerReviewForm.stars),
        comment: sellerReviewForm.comment,
        date: new Date().toISOString()
      });
      setSellerReviewForm(null);
      alert('Avaliação do vendedor enviada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar avaliação do vendedor.');
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

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
              type="button" 
              className={loginMode === 'login' ? 'btn-primary' : 'btn-secondary'} 
              style={{ flex: 1, padding: '0.5rem' }} 
              onClick={() => setLoginMode('login')}
            >
              Já sou cliente
            </button>
            <button 
              type="button" 
              className={loginMode === 'register' ? 'btn-primary' : 'btn-secondary'} 
              style={{ flex: 1, padding: '0.5rem' }} 
              onClick={() => setLoginMode('register')}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>CPF</label>
              <input 
                type="text" 
                required 
                placeholder="000.000.000-00" 
                value={loginForm.cpf}
                onChange={handleCpfChange}
              />
            </div>
            
            {loginMode === 'register' && (
              <>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>CNPJ da Empresa (Fornecedor)</label>
                  <select 
                    required 
                    value={loginForm.cnpj}
                    onChange={handleCompanyChange}
                  >
                    <option value="">Selecione uma empresa...</option>
                    {companies.map(comp => (
                      <option key={comp.id || comp.cnpj} value={comp.cnpj}>{comp.name} - {comp.cnpj}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Seu Nome Completo</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: João da Silva" 
                    value={loginForm.name}
                    onChange={e => setLoginForm({ ...loginForm, name: e.target.value })}
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
              </>
            )}
            
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>
              {loginMode === 'login' ? 'Entrar' : 'Acessar Catálogo'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="header glass-panel" style={{ padding: '1rem 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={logo} alt="Logo" style={{ height: '40px', width: '40px', borderRadius: '8px', objectFit: 'cover' }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333', fontWeight: 'bold' }}>PRODUTOS</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
          {/* Bell Icon */}
          <div 
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => setShowMyProfile(true)}
            title="Notificações"
          >
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            {hasNfeNotification && (
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '12px', height: '12px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid white' }}></span>
            )}
          </div>
          {isUserMenuOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsUserMenuOpen(false)} />
          )}
          
          <div 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
              background: 'transparent', border: 'none', position: 'relative', zIndex: 100
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', background: '#fff', 
              color: '#333', display: 'flex', justifyContent: 'center', alignItems: 'center',
              fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)', position: 'relative'
            }}>
              {customerInfo.name.charAt(0).toUpperCase()}
              {hasUnreadClient && <span style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid white' }}></span>}
            </div>
            <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{ fontWeight: '400', color: '#333', fontSize: '0.9rem' }}>
                {customerInfo.name.split(' ')[0]}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#666', transform: isUserMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </div>
          </div>

          {/* Menu Dropdown */}
          {isUserMenuOpen && (
            <div style={{
              position: 'absolute', top: '120%', right: '0', background: '#fff',
              borderRadius: '0.5rem', width: '260px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {/* Profile Header in Dropdown */}
              <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #eee' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', background: '#ff921c', 
                  color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center',
                  fontWeight: 'bold', fontSize: '1.2rem'
                }}>
                  {customerInfo.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{customerInfo.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>CPF: {customerInfo.cpf}</div>
                </div>
              </div>
              
              {/* Dropdown Options */}
              <div style={{ padding: '0.5rem 0' }}>
                <button 
                  onClick={() => { setShowProfileModal(true); setIsUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>👤</span> Perfil
                </button>
                <button 
                  onClick={() => { setShowMyProfile(true); setIsUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>🛍️</span> Compras
                  {hasUnreadClient && <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', marginLeft: 'auto' }}></span>}
                </button>
                <button 
                  onClick={() => { setShowViewedHistoryModal(true); setIsUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>📜</span> Histórico
                </button>
                <button 
                  onClick={() => { setShowMeusPedidosModal(true); setIsUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>📦</span> Meus Pedidos
                </button>
                <button 
                  onClick={() => { setShowPaymentModal(true); setIsUserMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>💳</span> Pagamentos
                </button>
                <div style={{ height: '1px', background: '#eee', margin: '0.25rem 0' }} />
                <button 
                  onClick={() => {
                    localStorage.removeItem('vitrine_customer');
                    setCustomerInfo(null);
                  }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--danger)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem' }}>🚪</span> Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Sub-header Navigation */}
      <div style={{ background: 'var(--primary-color)', padding: '0 5% 0.75rem', display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.9rem', color: '#fff', position: 'relative', zIndex: 90 }}>
        
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Categorias <span style={{ fontSize: '0.6rem', transform: isCategoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {isCategoryMenuOpen && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsCategoryMenuOpen(false)} />
              <div style={{ 
                position: 'absolute', top: '100%', left: 0, background: '#333', color: '#fff', 
                borderRadius: '4px', marginTop: '0.5rem', width: '220px', zIndex: 91,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '0.5rem 0'
              }}>
                {/* Seta superior do dropdown escuro */}
                <div style={{ position: 'absolute', top: '-5px', left: '20px', width: '10px', height: '10px', background: '#333', transform: 'rotate(45deg)' }} />
                
                <div 
                  onClick={() => { setSelectedCategory(''); setIsCategoryMenuOpen(false); setActiveTab('produtos'); }} 
                  style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', background: selectedCategory === '' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.target.style.background = selectedCategory === '' ? 'rgba(255,255,255,0.1)' : 'transparent'}
                >Todos os Produtos</div>
                {['Tecnologia', 'Casa e Móveis', 'Eletrodomésticos', 'Esportes e Fitness', 'Ferramentas', 'Supermercado', 'Veículos', 'Construção', 'Indústria e Comércio', 'Outros'].map(cat => (
                  <div 
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setIsCategoryMenuOpen(false); setActiveTab('produtos'); }} 
                    style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', background: selectedCategory === cat ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.target.style.background = selectedCategory === cat ? 'rgba(255,255,255,0.1)' : 'transparent'}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div onClick={() => { setActiveTab('ofertas'); setSelectedCategory(''); }} style={{ cursor: 'pointer', fontWeight: activeTab === 'ofertas' ? 'bold' : 'normal' }}>Ofertas</div>
        <div onClick={() => { setActiveTab('cupons'); setSelectedCategory(''); }} style={{ cursor: 'pointer', fontWeight: activeTab === 'cupons' ? 'bold' : 'normal' }}>Cupons</div>
      </div>

      <div className="app-container" style={{ padding: '0 5%' }}>

      <main className="main-content" style={{ marginTop: '2rem' }}>
        <div className="toolbar glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
            {activeTab === 'ofertas' ? 'Ofertas do Dia' : (activeTab === 'cupons' ? 'Seus Cupons de Desconto' : (selectedCategory ? `Categoria: ${selectedCategory}` : 'Produtos Disponíveis'))}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'flex-end', position: 'relative' }}>
            {activeTab === 'produtos' && (
              <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
                <input 
                  type="text" 
                  placeholder="Buscar produtos, marcas e muito mais..." 
                  value={searchTerm}
                  onFocus={() => setShowSearchHistory(true)}
                  onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearchHistory(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      const newHistory = [searchTerm.trim(), ...searchHistory.filter(h => h !== searchTerm.trim())].slice(0, 5);
                      setSearchHistory(newHistory);
                      localStorage.setItem('vitrine_search_history', JSON.stringify(newHistory));
                      setShowSearchHistory(false);
                    }
                  }}
                  style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '4px', border: '1px solid #ccc', outline: 'none', fontSize: '1rem', boxShadow: '0 1px 2px 0 rgba(0,0,0,.1)' }}
                />
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '1.2rem' }}>🔍</span>
                
                {showSearchHistory && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: '0 0 4px 4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 110, overflow: 'hidden' }}>
                    {/* Histórico quando não tem busca */}
                    {!searchTerm.trim() && searchHistory.map((h, i) => (
                      <div 
                        key={`hist-${i}`} 
                        onClick={() => { setSearchTerm(h); setShowSearchHistory(false); }}
                        style={{ padding: '0.85rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem', color: '#333' }}
                        onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                        onMouseOut={(e) => e.target.style.background = '#fff'}
                      >
                        <span style={{ opacity: 0.4, fontSize: '1.2rem' }}>🕒</span> {h}
                      </div>
                    ))}

                    {/* Auto-completar quando tem busca */}
                    {searchTerm.trim() && catalog
                      .filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .slice(0, 5)
                      .map((p, i) => (
                        <div 
                          key={`sug-${i}`} 
                          onClick={() => { 
                            setSearchTerm(p.name);
                            const newHistory = [p.name, ...searchHistory.filter(h => h !== p.name)].slice(0, 5);
                            setSearchHistory(newHistory);
                            localStorage.setItem('vitrine_search_history', JSON.stringify(newHistory));
                            setShowSearchHistory(false); 
                          }}
                          style={{ padding: '0.85rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem', color: '#333' }}
                          onMouseOver={(e) => e.target.style.background = '#f5f5f5'}
                          onMouseOut={(e) => e.target.style.background = '#fff'}
                        >
                          <span style={{ opacity: 0.4, fontSize: '1.2rem' }}>🔍</span> 
                          <span>
                            {(p.name || '').toLowerCase().split(searchTerm.toLowerCase()).map((part, index, array) => (
                              <span key={index}>
                                {part}
                                {index < array.length - 1 && <strong>{searchTerm.toLowerCase()}</strong>}
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            
            <button className="btn-secondary" onClick={() => setIsCartOpen(true)} style={{ position: 'relative' }}>
              🛒 Ver Carrinho
              {cart.length > 0 && (
                <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary-color)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {cart.reduce((a,c) => a + c.cartQuantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {(() => {
          const activeOffers = catalog.filter(i => i.isOffer && (!i.offerEndsAt || new Date(i.offerEndsAt).getTime() > Date.now()));
          
          if (activeTab === 'produtos' && !searchTerm && activeOffers.length > 0) {
            return (
              <div style={{ marginBottom: '2rem', background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                    Ofertas ⏰ Relâmpago
                  </h2>
                  
                  {(() => {
                    const earliestOffer = [...activeOffers].sort((a,b) => new Date(a.offerEndsAt || '2099-01-01').getTime() - new Date(b.offerEndsAt || '2099-01-01').getTime())[0];
                    if (earliestOffer) {
                      const endsAt = earliestOffer.offerEndsAt || new Date(new Date().setHours(23,59,59,999)).toISOString();
                      return <Countdown endsAt={endsAt} />;
                    }
                    return null;
                  })()}

                  <div style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => setActiveTab('ofertas')}>Ver Tudo &gt;</div>
                </div>
                
                <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
                  {activeOffers.map(item => (
                <div key={`offer-${item.id}`} onClick={() => handleViewProduct(item)} style={{ minWidth: '180px', maxWidth: '180px', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: '#ff7700', color: 'white', padding: '0.1rem 0.4rem', fontSize: '0.8rem', fontWeight: 'bold', zIndex: 2 }}>
                    -{Math.floor(Math.random() * 50 + 10)}%
                  </div>
                  <div style={{ position: 'absolute', top: 0, left: 0, background: 'var(--danger)', color: 'white', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold', zIndex: 2 }}>
                    Oficial
                  </div>
                  
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '180px', objectFit: 'contain', background: '#fff' }} />
                  ) : (
                    <div style={{ width: '100%', height: '180px', background: 'var(--background-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                      📦
                    </div>
                  )}
                  
                  <div style={{ padding: '0.5rem 0', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ color: '#ff7700', fontWeight: 'bold', fontSize: '1.2rem' }}>R$ {Number(item.price).toFixed(2)}</div>
                    <div style={{ background: 'linear-gradient(90deg, #ff4e00 0%, #ff9500 100%)', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', borderRadius: '10px', padding: '0.2rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      🔥 {item.sold || Math.floor(Math.random() * 50 + 5)} ITENS VENDIDOS
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
            );
          }
          return null;
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {activeTab === 'cupons' ? (
            coupons.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum cupom disponível no momento.</p>
            ) : (
              coupons.map(coupon => {
                const isExhausted = coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit;
                const isExpired = new Date(coupon.expireDate) < new Date();
                const isUnavailable = isExhausted || isExpired;
                return (
                  <div key={coupon.id} style={{
                    background: 'white',
                    borderRadius: '0.5rem',
                    border: '1px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ padding: '1.25rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem' }}>
                          🎟️
                        </div>
                        <span style={{ fontSize: '0.85rem', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>Oferta Exclusiva</span>
                      </div>
                      
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#333' }}>
                        {coupon.discount}% OFF
                      </h3>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                        Código: <strong>{coupon.code}</strong>
                      </p>
                      
                      <div style={{ display: 'inline-block', background: '#fee2e2', color: 'var(--primary-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Oficial
                      </div>
                    </div>
                    
                    {/* Linha serrilhada */}
                    <div style={{ position: 'relative', height: '1px', borderTop: '2px dashed #e0e0e0', margin: '0 1rem' }}>
                      <div style={{ position: 'absolute', left: '-20px', top: '-10px', width: '20px', height: '20px', background: '#f8f9fa', borderRadius: '50%', borderRight: '1px solid #e0e0e0' }}></div>
                      <div style={{ position: 'absolute', right: '-20px', top: '-10px', width: '20px', height: '20px', background: '#f8f9fa', borderRadius: '50%', borderLeft: '1px solid #e0e0e0' }}></div>
                    </div>

                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => alert(`Válido até ${new Date(coupon.expireDate).toLocaleDateString()}`)}>Condições</span>
                      {isUnavailable ? (
                        <button disabled style={{ background: '#e0e0e0', color: '#888', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'not-allowed' }}>
                          {isExhausted ? 'Esgotado' : 'Expirado'}
                        </button>
                      ) : (
                        <button style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => {
                          setCart(cart.map(c => c)); // Força re-render caso necessário
                          alert(`Cupom ${coupon.code} copiado! Adicione produtos ao carrinho para aplicar.`);
                        }}>
                          Eu quero
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )
          ) : (
          catalog.filter(item => {
            if (activeTab === 'ofertas' && !item.isOffer) return false;
            if (selectedCategory && item.category !== selectedCategory) return false;
            if (searchTerm && !(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(item.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
          }).map(item => {
            const status = getStatusConfig(item.quantity);
            return (
              <div 
                key={item.id} 
                className="glass-panel" 
                style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => handleViewProduct(item)}
              >
                {item.freeShipping && (
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#00a650', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 10 }}>
                    Frete Grátis
                  </div>
                )}
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '150px', objectFit: 'contain', borderRadius: '0.5rem', background: '#fff' }} />
                ) : (
                  <div style={{ width: '100%', height: '150px', background: 'var(--background-color)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                    📦
                  </div>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SKU: {item.sku}</div>
                <div>
                  <h3 style={{ margin: '0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{item.name}</h3>
                  
                  {/* Reviews Summary Snippet */}
                  {(() => {
                    const revs = productReviews.filter(r => r.productId === item.sku);
                    if (revs.length === 0) return <div style={{ fontSize: '0.8rem', color: '#999', margin: '0.25rem 0' }}>Sem avaliações ainda</div>;
                    const avg = revs.reduce((a, b) => a + b.stars, 0) / revs.length;
                    return (
                      <div style={{ fontSize: '0.8rem', color: '#ff921c', margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {'★'.repeat(Math.round(avg))}<span style={{ color: '#ccc' }}>{'★'.repeat(5 - Math.round(avg))}</span> 
                        <span style={{ color: '#666' }}>({revs.length} avaliações)</span>
                      </div>
                    );
                  })()}

                  {item.isOffer ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.85rem' }}>
                        R$ {Number(item.originalPrice).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        R$ {Number(item.price).toFixed(2)}
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#00a650' }}>OFERTA DO DIA</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '0.5rem' }}>
                      R$ {Number(item.price).toFixed(2)}
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', color: '#00a650', marginTop: '0.1rem', fontWeight: '500' }}>
                    em 10x de R$ {(Number(item.price) / 10).toFixed(2)} sem juros
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{item.sold || 0} vendidos</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#3483fa', fontWeight: '500', marginBottom: '0.25rem' }}>
                      Chegará em até {item.deliveryDays || 3} dias
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Em estoque</div>
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
                    onClick={(e) => { e.stopPropagation(); setPurchaseItem(item); setPurchaseQuantity(1); }}
                    disabled={item.quantity === 0}
                  >
                    {item.quantity > 0 ? '🛒 Comprar' : 'Esgotado'}
                  </button>
                </div>
              </div>
            );
          }))}
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
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Quem está lhe atendendo?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select 
                  value={selectedSalesperson} 
                  onChange={e => setSelectedSalesperson(e.target.value)} 
                  required
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}
                >
                  <option value="">Selecione o vendedor...</option>
                  {users.filter(u => u.role === 'Vendedor').map((seller, idx) => (
                    <option key={idx} value={seller.name}>{seller.name}</option>
                  ))}
                </select>
                {selectedSalesperson && (
                  <button 
                    className="btn-secondary" 
                    onClick={() => setViewingProfile(users.find(u => u.name === selectedSalesperson))}
                    title="Ver Perfil do Vendedor"
                    style={{ padding: '0.75rem', height: 'auto' }}
                  >
                    Ver Perfil
                  </button>
                )}
              </div>
            </div>
            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-secondary" onClick={() => setPurchaseItem(null)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={confirmAddToCart} disabled={!selectedSalesperson}>🛒 Adicionar ao Carrinho</button>
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
                <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input 
                      type="text" 
                      placeholder="Inserir código do cupom" 
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      disabled={!!appliedCoupon}
                    />
                    {!appliedCoupon ? (
                      <button 
                        className="btn-secondary" 
                        onClick={() => {
                          const validCoupon = coupons.find(c => {
                            if (c.code !== couponInput) return false;
                            if (new Date(c.expireDate) < new Date()) return false;
                            if (c.usageLimit && (c.usedCount || 0) >= c.usageLimit) return false;
                            return true;
                          });
                          
                          if (validCoupon) {
                            setAppliedCoupon(validCoupon);
                          } else {
                            alert('Cupom inválido, esgotado ou expirado');
                          }
                        }}
                      >Aplicar</button>
                    ) : (
                      <button className="btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}>Remover</button>
                    )}
                  </div>
                  
                  {/* Cupons Disponíveis */}
                  {!appliedCoupon && coupons.filter(c => 
                    new Date(c.expireDate) >= new Date() && 
                    (!c.usageLimit || (c.usedCount || 0) < c.usageLimit) &&
                    (!c.targetCpf || c.targetCpf === customerInfo.cpf)
                  ).length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Cupons Disponíveis:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {coupons.filter(c => 
                          new Date(c.expireDate) >= new Date() && 
                          (!c.usageLimit || (c.usedCount || 0) < c.usageLimit) &&
                          (!c.targetCpf || c.targetCpf === customerInfo.cpf)
                        ).map(c => (
                          <div 
                            key={c.id} 
                            style={{ background: 'var(--primary-color)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            onClick={() => {
                              setCouponInput(c.code);
                              setAppliedCoupon(c);
                            }}
                          >
                            🎟️ {c.code} ({c.discount}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Produtos ({cart.reduce((a,c) => a + c.cartQuantity, 0)})</span>
                    <span>R$ {cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0).toFixed(2)}</span>
                  </div>
                  
                  {appliedCoupon && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#00a650' }}>
                      <span>Desconto do Cupom ({appliedCoupon.discount}%)</span>
                      <span>- R$ {(cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0) * appliedCoupon.discount / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    <span>Total:</span>
                    <span style={{ color: 'var(--primary-color)' }}>
                      R$ {(() => {
                        const subtotal = cart.reduce((a,c) => a + (c.price * c.cartQuantity), 0);
                        const discount = appliedCoupon ? (subtotal * appliedCoupon.discount / 100) : 0;
                        return (subtotal - discount).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Forma de Pagamento</label>
                  <select value={checkoutMethod} onChange={e => setCheckoutMethod(e.target.value)}>
                    <option value="PIX">PIX (5% Desconto Adicional)</option>
                    <option value="Cartão de Crédito">Cartão de Crédito (Até 12x)</option>
                    <option value="Boleto">Boleto Bancário</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={() => setCart([])}>Esvaziar Carrinho</button>
              <button className="btn-primary" 
                onClick={() => {
                  if (checkoutMethod === 'Cartão de Crédito') {
                    if (savedCards.length === 0) {
                      if (window.confirm('Você não tem cartões salvos. Deseja ir para Pagamentos para adicionar um?')) {
                        setIsCartOpen(false);
                        setShowPaymentModal(true);
                      }
                    } else {
                      setSelectedCard(savedCards[0]);
                      setShowCardCheckout(true);
                    }
                  } else {
                    handleCheckout();
                  }
                }}
                disabled={cart.length === 0 || isPixLoading || isCardLoading} 
                style={{ gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isPixLoading ? (
                  <>
                    <div style={{ width: '14px', height: '14px', borderTopColor: 'white', borderTopStyle: 'solid', borderWidth: '2px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Gerando PIX...
                  </>
                ) : (
                  <>🛒 Finalizar Pedido</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Pagamento Real com Cartão (Mercado Pago SDK) ===== */}
      {showMpCardForm && (
        <div className="modal-overlay" style={{ zIndex: 1060 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>💳 Pagamento com Cartão</h2>
              <button className="close-btn" onClick={() => setShowMpCardForm(false)} disabled={isCardLoading}>×</button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#999', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              🔒 Dados protegidos pelo Mercado Pago — não compartilhados conosco.
            </div>

            {selectedCard && (
              <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Pagar com {selectedCard.brand} final {selectedCard.last4}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Por segurança, insira os dados do cartão selecionado para validar a compra.</span>
              </div>
            )}

              <form id="mp-card-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Número do Cartão</label>
                <div id="mp-card-number" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nome do Titular</label>
                <div id="mp-cardholder-name" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Validade</label>
                  <div id="mp-expiration-date" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>CVV</label>
                  <div id="mp-security-code" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tipo de Documento</label>
                  <div id="mp-identification-type" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>CPF/CNPJ</label>
                  <div id="mp-identification-number" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>E-mail para recibo</label>
                <div id="mp-cardholder-email" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
              </div>

              <div style={{ display: 'none' }}>
                <div id="mp-issuer"></div>
              </div>

              <div style={{ display: 'none' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Parcelas</label>
                <div id="mp-installments" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '46px', overflow: 'hidden', background: 'white' }}></div>
              </div>

              <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                  <span>Total da compra</span>
                  <span style={{ color: 'var(--primary-color)' }}>R$ {cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0).toFixed(2)}</span>
                </div>
              </div>

              {!isMpFormMounted && (
                <div style={{ textAlign: 'center', color: '#999', fontSize: '0.85rem', padding: '0.5rem' }}>
                  ⏳ Carregando formulário seguro...
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.9rem', opacity: (!isMpFormMounted || isCardLoading) ? 0.6 : 1 }}
                disabled={!isMpFormMounted || isCardLoading}
              >
                {isCardLoading ? '⏳ Processando pagamento...' : '🔒 Pagar Agora'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Gerenciar Pagamentos ===== */}
      {showPaymentModal && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>💳 Meus Pagamentos</h2>
              <button className="close-btn" onClick={() => { setShowPaymentModal(false); setShowAddCardForm(false); }}>×</button>
            </div>

            {/* Lista de cartões salvos */}
            {!showAddCardForm && (
              <div style={{ marginTop: '1rem' }}>
                {savedCards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
                    <p>Nenhum cartão cadastrado.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {savedCards.map(card => (
                      <div key={card.id} style={{
                        background: card.type === 'credit'
                          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                          : 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
                        borderRadius: '12px', padding: '1.25rem 1.5rem', color: 'white',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                            {card.type === 'credit' ? '💳 CRÉDITO' : '💳 DÉBITO'} · {card.brand}
                          </div>
                          <div style={{ fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                            •••• •••• •••• {card.last4}
                          </div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8 }}>
                            {card.holder.toUpperCase()} · {card.expiry}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
                            color: 'white', cursor: 'pointer', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowAddCardForm(true)}>
                  + Adicionar Novo Cartão
                </button>
              </div>
            )}

            {/* Formulário de novo cartão */}
            {showAddCardForm && (
              <form onSubmit={handleSaveCard} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tipo de Cartão</label>
                  <select className="input-primary" value={cardForm.type} onChange={e => setCardForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="credit">💳 Crédito</option>
                    <option value="debit">💳 Débito</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Número do Cartão</label>
                  <input className="input-primary" placeholder="0000 0000 0000 0000" value={cardForm.number}
                    onChange={e => setCardForm(p => ({ ...p, number: formatCardNumber(e.target.value) }))} required maxLength={19} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nome do Titular</label>
                  <input className="input-primary" placeholder="Como impresso no cartão" value={cardForm.holder}
                    onChange={e => setCardForm(p => ({ ...p, holder: e.target.value.toUpperCase() }))} required />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Validade</label>
                    <input className="input-primary" placeholder="MM/AA" value={cardForm.expiry}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
                        setCardForm(p => ({ ...p, expiry: v }));
                      }} required maxLength={5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CVV</label>
                    <input className="input-primary" type="password" placeholder="•••" value={cardForm.cvv}
                      onChange={e => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required maxLength={4} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddCardForm(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>Salvar Cartão</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== Modal: Checkout com Cartão ===== */}
      {showCardCheckout && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>💳 Pagar com Cartão</h2>
              <button className="close-btn" onClick={() => setShowCardCheckout(false)}>×</button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Selecione o cartão para pagamento:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {savedCards.map(card => (
                  <div key={card.id}
                    onClick={() => setSelectedCard(card)}
                    style={{
                      border: `2px solid ${selectedCard?.id === card.id ? 'var(--primary-color)' : '#e5e7eb'}`,
                      borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer',
                      background: selectedCard?.id === card.id ? '#fff7ed' : 'white',
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      transition: 'all 0.2s'
                    }}>
                    <div style={{
                      width: '48px', height: '32px', borderRadius: '6px',
                      background: card.type === 'credit' ? 'linear-gradient(135deg, #1a1a2e, #0f3460)' : 'linear-gradient(135deg, #134e5e, #71b280)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold'
                    }}>{card.brand.slice(0, 4)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>•••• {card.last4}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>{card.holder} · {card.type === 'credit' ? 'Crédito' : 'Débito'}</div>
                    </div>
                    {selectedCard?.id === card.id && <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>✓</span>}
                  </div>
                ))}
              </div>

              {selectedCard?.type === 'credit' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Número de Parcelas</label>
                  <select className="input-primary" value={installments} onChange={e => setInstallments(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                      const total = cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0);
                      const val = (total / n).toFixed(2);
                      return <option key={n} value={n}>{n}x de R$ {val}{n === 1 ? ' sem juros' : ''}</option>;
                    })}
                  </select>
                </div>
              )}

              <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Total</span>
                  <strong>R$ {cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0).toFixed(2)}</strong>
                </div>
                {selectedCard?.type === 'credit' && installments > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>
                    <span>{installments}x de</span>
                    <span>R$ {(cart.reduce((a, c) => a + (c.price * c.cartQuantity), 0) / installments).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <button className="btn-primary" style={{ width: '100%', padding: '0.9rem', opacity: (!selectedCard || isCardLoading) ? 0.6 : 1, cursor: (!selectedCard || isCardLoading) ? 'not-allowed' : 'pointer' }} 
                onClick={() => {
                  if (!selectedCard) return alert('Selecione um cartão para continuar.');
                  setShowCardCheckout(false);
                  setShowMpCardForm(true);
                }} 
                disabled={!selectedCard || isCardLoading}>
                Pagar com este cartão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Avaliação Pós Compra */}
      {showReviewModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2>Avalie seu Atendimento</h2>
              <button className="close-btn" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Como foi o atendimento com {reviewData.salesperson}?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '2rem', cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star} 
                  onClick={() => setReviewData({...reviewData, stars: star})}
                  style={{ color: star <= reviewData.stars ? '#fbbf24' : '#e5e7eb' }}
                >
                  ★
                </span>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <textarea 
                placeholder="Deixe um comentário sobre a sua experiência (Opcional)"
                value={reviewData.comment}
                onChange={e => setReviewData({...reviewData, comment: e.target.value})}
                style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setShowReviewModal(false)}>Pular</button>
              <button className="btn-primary" onClick={handleSubmitReview}>Enviar Avaliação</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perfil do Vendedor */}
      {viewingProfile && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Perfil do Vendedor</h2>
              <button className="close-btn" onClick={() => setViewingProfile(null)}>×</button>
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1rem', fontWeight: 'bold' }}>
                {viewingProfile.name.charAt(0)}
              </div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>{viewingProfile.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>{viewingProfile.role || 'Vendedor'}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {deals.filter(d => d.salesperson === viewingProfile.name && d.status === 'Ganho').length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vendas Realizadas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {(() => {
                    const sellerReviews = reviews.filter(r => r.salesperson === viewingProfile.name);
                    if (sellerReviews.length === 0) return 'N/A';
                    const avg = sellerReviews.reduce((a,c) => a + c.stars, 0) / sellerReviews.length;
                    return avg.toFixed(1) + ' ★';
                  })()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avaliação Média</div>
              </div>
            </div>

            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Últimas Avaliações</h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {reviews.filter(r => r.salesperson === viewingProfile.name).length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>Nenhuma avaliação ainda.</p>
                ) : (
                  reviews.filter(r => r.salesperson === viewingProfile.name).map((r, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.client}</span>
                        <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>{'★'.repeat(r.stars)}</span>
                      </div>
                      {r.comment && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>"{r.comment}"</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="form-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setViewingProfile(null)}>Fechar Perfil</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Meu Perfil */}
      {showProfileModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Meu Perfil</h2>
              <button className="close-btn" onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Data de Nascimento</label>
                <input 
                  type="date" 
                  value={profileData.birthday} 
                  onChange={e => setProfileData({...profileData, birthday: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>CEP</label>
                <input 
                  type="text" 
                  value={profileData.zip} 
                  onChange={e => setProfileData({...profileData, zip: e.target.value})} 
                  placeholder="00000-000"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Endereço / Rua</label>
                <input 
                  type="text" 
                  value={profileData.address} 
                  onChange={e => setProfileData({...profileData, address: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Bairro</label>
                <input 
                  type="text" 
                  value={profileData.neighborhood} 
                  onChange={e => setProfileData({...profileData, neighborhood: e.target.value})} 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Município</label>
                  <input 
                    type="text" 
                    value={profileData.city} 
                    onChange={e => setProfileData({...profileData, city: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <input 
                    type="text" 
                    value={profileData.state} 
                    onChange={e => setProfileData({...profileData, state: e.target.value})} 
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Salvar Perfil</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Histórico Visualizado */}
      {showViewedHistoryModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Histórico de Produtos Visualizados</h2>
              <button className="close-btn" onClick={() => setShowViewedHistoryModal(false)}>×</button>
            </div>
            {viewedProductsHistory.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Você ainda não visualizou nenhum produto.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {viewedProductsHistory.map(item => (
                  <div 
                    key={item.id} 
                    style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    onClick={() => { setShowViewedHistoryModal(false); handleViewProduct(item); }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} style={{ width: '100px', height: '100px', objectFit: 'contain', marginBottom: '1rem' }} />
                    ) : (
                      <div style={{ width: '100px', height: '100px', background: 'var(--background-color)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '1rem' }}>📦</div>
                    )}
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'center', marginBottom: '0.5rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>R$ {Number(item.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="form-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowViewedHistoryModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Minhas Compras */}
      {showMyProfile && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Minhas Compras</h2>
              <button className="close-btn" onClick={() => setShowMyProfile(false)}>×</button>
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {deals.filter(d => d.customerCpf === customerInfo.cpf || d.client === customerInfo.name).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Você ainda não fez nenhuma compra nesta loja.</p>
              ) : (
                                deals.filter(d => d.customerCpf === customerInfo.cpf || d.client === customerInfo.name).map(deal => (
                  <div 
                    key={deal.id} 
                    style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => setViewingDeal(viewingDeal === deal.id ? null : deal.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{new Date(deal.date).toLocaleDateString()}</strong>
                      <span style={{ 
                        background: deal.shippingStatus === 'Entregue' ? '#d1fae5' : (deal.status === 'Perdido' ? '#fee2e2' : '#fef3c7'), 
                        color: deal.shippingStatus === 'Entregue' ? '#065f46' : (deal.status === 'Perdido' ? '#991b1b' : '#92400e'),
                        padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold'
                      }}>
                        {deal.shippingStatus === 'Entregue' ? 'Finalizado' : deal.status === 'Perdido' ? 'Cancelado' : 'Em andamento'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <strong>Itens: </strong>
                      {deal.products ? deal.products.map(p => `${p.quantity}x ${p.name}`).join(', ') : 'N/A'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vendedor: {deal.salesperson || 'N/A'}</span>
                      <strong style={{ color: 'var(--primary-color)' }}>R$ {deal.value.toFixed(2)}</strong>
                    </div>

                    {viewingDeal === deal.id && deal.status !== 'Perdido' && (
                      <div style={{ marginTop: '1.5rem', borderTop: '1px dashed #ccc', paddingTop: '1rem' }}>
                        
                        {/* Status timeline */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1.5rem', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '10px', left: '10%', right: '10%', height: '2px', background: '#eee', zIndex: 0 }}></div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.25rem', color: ['Recebido', 'Preparando', 'Em Trânsito', 'Entregue'].includes(deal.shippingStatus || 'Recebido') ? '#00a650' : '#ccc' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: ['Recebido', 'Preparando', 'Em Trânsito', 'Entregue'].includes(deal.shippingStatus || 'Recebido') ? '#00a650' : '#ccc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                            <span>Recebido</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.25rem', color: ['Preparando', 'Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#ccc' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: ['Preparando', 'Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#eee', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{['Preparando', 'Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '✓' : ''}</div>
                            <span>Preparando</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.25rem', color: ['Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#ccc' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: ['Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#eee', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{['Em Trânsito', 'Entregue'].includes(deal.shippingStatus) ? '✓' : ''}</div>
                            <span>Em Trânsito</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '0.25rem', color: ['Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#ccc' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: ['Entregue'].includes(deal.shippingStatus) ? '#00a650' : '#eee', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{['Entregue'].includes(deal.shippingStatus) ? '✓' : ''}</div>
                            <span>Entregue</span>
                          </div>
                        </div>

                        {/* Rastreamento Customizado (Mensagens do Admin) */}
                        <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>📍 Atualizações do Envio</h4>
                          {deal.tracking && deal.tracking.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {deal.tracking.map((track, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '0.75rem', borderLeft: '2px solid #3483fa', paddingLeft: '10px' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '65px', flexShrink: 0 }}>
                                    {new Date(track.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: '#333' }}>
                                    {track.msg}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nenhuma atualização ainda.</p>
                          )}
                        </div>

                        {/* Mensagens com Vendedor */}
                        <div style={{ background: '#fff', border: '1px solid #ddd', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', background: '#00a650', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {deal.salesperson ? deal.salesperson.charAt(0).toUpperCase() : 'V'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Vendedor: {deal.salesperson || 'Atendimento'}</div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setInternalChat({ dealId: deal.id, msg: '' }); }}
                                style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: '#3483fa', textDecoration: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                Abrir Chat do Pedido
                                {deal.messages && deal.messages.length > 0 && deal.messages[deal.messages.length - 1].role === 'admin' && (
                                  <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', display: 'inline-block' }}></span>
                                )}
                              </button>
                              {deal.messages && deal.messages.length > 0 && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSellerReviewForm({ dealId: deal.id, salesperson: deal.salesperson || 'Atendimento', stars: 5, comment: '' }); }}
                                  style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: '#ff921c', textDecoration: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}
                                >
                                  ⭐ Avaliar Vendedor
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Informações da Compra (Nota Fiscal) */}
                        {deal.shippingStatus === 'Entregue' && (
                          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Informações da compra</h4>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <div style={{ width: '40px', height: '40px', background: '#f5f5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                📄
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', color: '#333' }}>Gerada em {new Date(deal.date).toLocaleDateString()}</div>
                                <a href="#" onClick={(e) => { e.preventDefault(); alert('Iniciando download da Nota Fiscal (DANFE)...'); }} style={{ fontSize: '0.8rem', color: '#3483fa', textDecoration: 'none' }}>Baixar nota fiscal ▾</a>
                              </div>
                            </div>
                          </div>
                        )}

                        {deal.shippingStatus === 'Entregue' && (
                          <div style={{ textAlign: 'center' }}>
                            <button 
                              className="btn-primary" 
                              style={{ width: '100%', padding: '0.75rem', background: '#3483fa' }}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setReviewForm({ 
                                  dealId: deal.id, 
                                  productId: deal.products[0]?.sku, 
                                  productName: deal.products[0]?.name,
                                  stars: 5, 
                                  comment: '', 
                                  photo: '' 
                                }); 
                              }}
                            >
                              ⭐ Opinar sobre o Produto
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))

              )}
            </div>

            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setShowMyProfile(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Modal Meus Pedidos (Shopee Layout) */}
      {showMeusPedidosModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', background: '#f5f5f5', padding: 0 }}>
            <div className="modal-header" style={{ background: '#fff', padding: '1rem', borderBottom: '1px solid #eee' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Meus Pedidos</h2>
              <button className="close-btn" onClick={() => setShowMeusPedidosModal(false)}>×</button>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {deals.filter(d => (d.customerCpf === customerInfo.cpf || d.client === customerInfo.name) && d.shippingStatus === 'Entregue').length === 0 ? (
                <div style={{ textAlign: 'center', background: '#fff', padding: '2rem', borderRadius: '4px' }}>Você ainda não tem pedidos finalizados.</div>
              ) : (
                deals.filter(d => (d.customerCpf === customerInfo.cpf || d.client === customerInfo.name) && d.shippingStatus === 'Entregue').map(deal => {
                  const hasReviewed = productReviews.some(r => r.dealId === deal.id);
                  return (
                  <div key={deal.id} style={{ background: '#fff', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                        🏪 {deal.salesperson || 'Geste Store'}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowMeusPedidosModal(false); setInternalChat({ dealId: deal.id, msg: '' }); }}
                          style={{ background: '#ee4d2d', color: 'white', border: 'none', padding: '0.1rem 0.4rem', borderRadius: '2px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          💬 Chat
                        </button>
                      </div>
                      <div style={{ color: '#00bfa5', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        🚚 Pedido entregue. FINALIZADO
                      </div>
                    </div>
                    
                    {/* Products */}
                    <div style={{ padding: '1rem' }}>
                      {deal.products && deal.products.map((prod, idx) => {
                        const catalogItem = catalog.find(c => c.sku === prod.sku);
                        return (
                          <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: idx !== deal.products.length - 1 ? '1rem' : '0', paddingBottom: idx !== deal.products.length - 1 ? '1rem' : '0', borderBottom: idx !== deal.products.length - 1 ? '1px solid #eee' : 'none' }}>
                            <div style={{ width: '80px', height: '80px', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                              {catalogItem && catalogItem.imageUrl ? (
                                <img src={catalogItem.imageUrl} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', color: '#333', marginBottom: '0.25rem' }}>{prod.name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#757575' }}>x{prod.quantity}</div>
                            </div>
                            <div style={{ fontWeight: 'bold', color: '#ee4d2d' }}>
                              R$ {Number(prod.price || 0).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Footer / Total */}
                    <div style={{ padding: '1rem', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#333' }}>Total do Pedido:</span>
                      <span style={{ fontSize: '1.25rem', color: '#ee4d2d', fontWeight: 'bold' }}>R$ {Number(deal.value).toFixed(2)}</span>
                    </div>
                    
                    {/* Actions */}
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                      <div style={{ fontSize: '0.75rem', color: '#757575' }}>
                        {deal.shippingStatus === 'Entregue' ? 'Avalie agora e receba 10 moedas' : 'Obrigado por comprar conosco!'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            style={{ background: '#ee4d2d', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                            onClick={() => {
                              setShowMeusPedidosModal(false);
                              setReviewForm({ 
                                dealId: deal.id, 
                                productId: deal.products[0]?.sku, 
                                productName: deal.products[0]?.name,
                                stars: 5, 
                                comment: '', 
                                photo: '' 
                              });
                            }}
                          >
                            Avaliar
                          </button>
                        <button 
                          style={{ background: '#ee4d2d', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => { setShowMeusPedidosModal(false); setInternalChat({ dealId: deal.id, msg: '' }); }}
                        >
                          Falar Com Vendedor
                        </button>
                        <button 
                          style={{ background: '#ee4d2d', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => {
                            setShowMeusPedidosModal(false);
                            if (deal.products) {
                              const newCart = [...cart];
                              deal.products.forEach(p => {
                                const exist = newCart.find(c => c.sku === p.sku);
                                if (exist) exist.cartQuantity += p.quantity;
                                else newCart.push({ ...catalog.find(c => c.sku === p.sku), cartQuantity: p.quantity });
                              });
                              setCart(newCart.filter(c => c.name));
                              localStorage.setItem('vitrine_cart', JSON.stringify(newCart.filter(c => c.name)));
                              setIsCartOpen(true);
                            }
                          }}
                        >
                          Comprar Novamente
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}

      {/* Review Product Modal */}
      {reviewForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Avaliar Produto</h2>
              <button className="close-btn" onClick={() => setReviewForm(null)}>×</button>
            </div>
            <form onSubmit={handleProductReviewSubmit}>
              <div style={{ marginBottom: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {reviewForm.productName}
              </div>
              
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label>Nota</label>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '2rem' }}>
                  {[1,2,3,4,5].map(star => (
                    <span 
                      key={star} 
                      onClick={() => setReviewForm({...reviewForm, stars: star})}
                      style={{ cursor: 'pointer', color: star <= reviewForm.stars ? '#ff921c' : '#ccc' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>O que achou do produto?</label>
                <textarea 
                  rows="3" 
                  value={reviewForm.comment}
                  onChange={e => setReviewForm({...reviewForm, comment: e.target.value})}
                  placeholder="Escreva sua opinião aqui..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}
                ></textarea>
              </div>

              <div className="form-group">
                <label>Foto do Produto (Opcional)</label>
                <div style={{ border: '2px dashed #ccc', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', cursor: 'pointer', color: '#666' }} onClick={() => {
                  const fakeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                  setReviewForm({...reviewForm, photo: fakeBase64});
                  alert('Foto anexada com sucesso!');
                }}>
                  {reviewForm.photo ? '✅ Foto Anexada (Clique para alterar)' : '📸 Clique para enviar uma foto'}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setReviewForm(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ background: '#ff921c' }}>Enviar Opinião</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Review Modal */}
      {sellerReviewForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Avaliar Vendedor</h2>
              <button className="close-btn" onClick={() => setSellerReviewForm(null)}>×</button>
            </div>
            
            <form onSubmit={handleSellerReview} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '2rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span 
                      key={star} 
                      onClick={() => setSellerReviewForm({...sellerReviewForm, stars: star})}
                      style={{ color: star <= sellerReviewForm.stars ? '#ff921c' : '#ccc', transition: 'color 0.2s' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Como foi o atendimento de {sellerReviewForm.salesperson}?
                </p>
              </div>

              <div className="form-group">
                <label>Deixe um comentário (Opcional)</label>
                <textarea 
                  rows="4" 
                  value={sellerReviewForm.comment}
                  onChange={e => setSellerReviewForm({...sellerReviewForm, comment: e.target.value})}
                  placeholder="Escreva sua experiência com o vendedor..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setSellerReviewForm(null)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ background: '#00a650' }}>Enviar Avaliação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Details & Reviews Modal */}
      {viewingProduct && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ paddingRight: '2rem' }}>{viewingProduct.name}</h2>
              <button className="close-btn" onClick={() => setViewingProduct(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Fotos */}
              <div style={{ width: '100%', background: '#fff', borderRadius: '0.5rem', padding: '1rem', position: 'relative' }}>
                {viewingProduct.freeShipping && (
                  <div style={{ position: 'absolute', top: '20px', left: '20px', background: '#00a650', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', zIndex: 10 }}>
                    Frete Grátis
                  </div>
                )}
                {viewingProduct.imageUrls && viewingProduct.imageUrls.length > 0 ? (
                  <div style={{ display: 'flex', overflowX: 'auto', gap: '1rem', scrollSnapType: 'x mandatory', paddingBottom: '0.5rem' }}>
                    {viewingProduct.imageUrls.map((url, idx) => (
                      <img key={idx} src={url} alt={`${viewingProduct.name} ${idx}`} style={{ flexShrink: 0, width: '100%', height: '300px', objectFit: 'contain', scrollSnapAlign: 'start' }} />
                    ))}
                  </div>
                ) : viewingProduct.imageUrl ? (
                  <img src={viewingProduct.imageUrl} alt={viewingProduct.name} style={{ width: '100%', height: '300px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '100%', height: '300px', background: 'var(--background-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>
                    📦
                  </div>
                )}
                {viewingProduct.imageUrls && viewingProduct.imageUrls.length > 1 && (
                  <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#888', margin: '0.5rem 0 0 0' }}>Deslize para ver mais fotos ↔️</p>
                )}
              </div>
              
              {/* Detalhes */}
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Detalhes do Produto</h3>
                
                {(() => {
                  const revs = productReviews.filter(r => r.productId === viewingProduct.sku);
                  const avg = revs.length > 0 ? revs.reduce((a, b) => a + b.stars, 0) / revs.length : 0;
                  return (
                    <div style={{ fontSize: '0.9rem', color: revs.length > 0 ? '#ff921c' : '#999', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {revs.length > 0 ? (
                        <>
                          {'★'.repeat(Math.round(avg))}<span style={{ color: '#ccc' }}>{'★'.repeat(5 - Math.round(avg))}</span> 
                          <span style={{ color: '#666' }}>({revs.length} avaliações)</span>
                        </>
                      ) : (
                        'Sem avaliações ainda'
                      )}
                    </div>
                  );
                })()}

                <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>SKU: {viewingProduct.sku}</p>
                <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Categoria: {viewingProduct.category || 'Outros'}</p>
                <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vendas: {viewingProduct.sold || 0} vendidos</p>
                <p style={{ margin: '0 0 0.25rem 0', color: '#3483fa', fontSize: '0.9rem', fontWeight: '500' }}>Chegará em até {viewingProduct.deliveryDays || 3} dias</p>
                
                <div style={{ margin: '1rem 0 0 0', fontSize: '1.8rem', fontWeight: 'bold', color: viewingProduct.isOffer ? 'var(--danger)' : 'var(--primary-color)' }}>
                  R$ {Number(viewingProduct.price).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.95rem', color: '#00a650', marginBottom: '1rem', fontWeight: '500' }}>
                  em 10x de R$ {(Number(viewingProduct.price) / 10).toFixed(2)} sem juros
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    disabled={viewingProduct.quantity <= 0}
                    style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                    onClick={() => {
                      const existing = cart.find(c => c.sku === viewingProduct.sku && c.salesperson === 'Atendimento');
                      if (existing) {
                        setCart(cart.map(c => (c.sku === viewingProduct.sku && c.salesperson === 'Atendimento') ? { ...c, cartQuantity: c.cartQuantity + 1 } : c));
                      } else {
                        setCart([...cart, { ...viewingProduct, cartQuantity: 1, salesperson: 'Atendimento' }]);
                      }
                      setViewingProduct(null);
                      alert('Adicionado ao carrinho com sucesso!');
                    }}
                  >
                    🛒 Adicionar Rápido
                  </button>
                  <button 
                    className="btn-primary" 
                    disabled={viewingProduct.quantity <= 0}
                    style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
                    onClick={() => { setPurchaseItem(viewingProduct); setPurchaseQuantity(1); setViewingProduct(null); }}
                  >
                    Comprar Agora
                  </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Opiniões do Produto</h3>
              
              {(() => {
                const revs = productReviews.filter(r => r.productId === viewingProduct.sku);
                if (revs.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>Este produto ainda não possui avaliações.</p>;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {revs.map((r, i) => (
                      <div key={i} style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.customerName || 'Cliente Anônimo'}</span>
                          <span style={{ color: '#ff921c' }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontSize: '0.9rem' }}>{r.comment}</p>
                        {r.photo && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <img src={r.photo} alt="Foto do Produto" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem' }}>
                          Enviado em {new Date(r.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="form-actions" style={{ marginTop: '2rem' }}>
              <button className="btn-secondary" onClick={() => setViewingProduct(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Chat Modal (Vitrine) */}
      {internalChat && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-panel" style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', height: '600px' }}>
            <div className="modal-header">
              <h2>Chat do Pedido (#{internalChat.dealId.slice(-6)})</h2>
              <button className="close-btn" onClick={() => setInternalChat(null)}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {(() => {
                const deal = deals.find(d => d.id === internalChat.dealId);
                const messages = deal?.messages || [];
                if (messages.length === 0) return <div style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>Nenhuma mensagem ainda.</div>;
                
                return messages.map((m, i) => {
                  const isClient = m.role === 'client';
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isClient ? 'flex-end' : 'flex-start' }}>
                      <div style={{ 
                        background: isClient ? '#dcf8c6' : '#fff', 
                        padding: '0.75rem', 
                        borderRadius: '0.5rem', 
                        maxWidth: '85%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isClient ? '#00a650' : '#333', marginBottom: '0.25rem' }}>
                          {m.sender} {isClient ? '(Você)' : '(Vendedor)'}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#333', wordBreak: 'break-word' }}>
                          {m.text}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#999', textAlign: 'right', marginTop: '0.25rem' }}>
                          {new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <form onSubmit={handleSendInternalMessage} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Digite sua mensagem..." 
                value={internalChat.msg}
                onChange={e => setInternalChat({...internalChat, msg: e.target.value})}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '2rem', border: '1px solid #ccc' }}
              />
              <button type="submit" className="btn-primary" style={{ borderRadius: '2rem', padding: '0.75rem 1.5rem' }}>
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pix Payment Modal */}
      {pixPayment && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Pague via PIX</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Escaneie o QR Code abaixo com o aplicativo do seu banco para finalizar o pedido no valor de <strong>R$ {pixPayment.total.toFixed(2)}</strong>.
            </p>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', display: 'inline-block', marginBottom: '1rem' }}>
              <img src={`data:image/jpeg;base64,${pixPayment.qrCodeBase64}`} alt="QR Code PIX" style={{ width: '200px', height: '200px' }} />
            </div>
            
            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ou utilize a chave Copia e Cola:</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" readOnly value={pixPayment.qrCode} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', background: '#f5f5f5', color: '#333' }} />
                <button 
                  className="btn-primary" 
                  style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    navigator.clipboard.writeText(pixPayment.qrCode);
                    alert('Chave PIX copiada!');
                  }}
                >
                  Copiar
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '20px', height: '20px', borderTopColor: 'var(--primary-color)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderStyle: 'solid', borderWidth: '3px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Aguardando pagamento...</span>
            </div>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            
            <div style={{ marginTop: '2rem' }}>
              <button className="btn-secondary" onClick={() => setPixPayment(null)}>Cancelar Operação</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        textAlign: 'center',
        padding: '2rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        borderTop: '1px solid var(--glass-border)'
      }}>
        © 2026 Direitos Reservados - Feito com ❤️ pela equipe GESTE
      </footer>

    </>
  );
}

export default App;
