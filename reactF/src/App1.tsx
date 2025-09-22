import React, { useEffect, useRef, useState } from "react";
import { Search, Mic, X, User, ShoppingCart, Menu, Minus, Plus, Star, Heart } from 'lucide-react';
import "./App.css"
// --- TYPE DEFINITIONS ---
interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  rating: number;
  stock: number;
  brand: string;
  category: string;
  thumbnail: string;
  images: string[];
}

interface CartItem {
  product_id: number;
  title:string;
  price: number;
  image: string;
  quantity: number;
}

// --- API BASE URL ---
const API_BASE = "https://backfinal-7pi0.onrender.com";

// --- MAIN APP COMPONENT ---
export default function App() {
  // --- STATE MANAGEMENT ---
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sort, setSort] = useState("id");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); }
    catch (e) { return []; }
  });
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string>(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState<string>(() => localStorage.getItem("user") || "");
  const [authModal, setAuthModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  
  // --- VOICE SEARCH STATE ---
  const recognitionRef = useRef<any>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);

  // --- EFFECTS ---
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { loadProducts(); }, [page, selectedCategory, sort, search]);
  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", user);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser("");
    }
  }, [token, user]);
  
  // --- VOICE SEARCH INITIALIZATION ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setMicSupported(false);
        return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e.error);
        setListening(false);
    };
    rec.onresult = (e: any) => {
        const text = Array.from(e.results).map((r: any) => r[0]?.transcript ?? "").join(" ").trim();
        if (text) setSearch(text);
    };

    recognitionRef.current = rec;
    setMicSupported(true);

    return () => {
        try { rec.abort(); } catch {}
    };
  }, []);

  // --- DATA FETCHING & API LOGIC ---
  async function fetchCategories() {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (e) { console.warn(e); }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      let url: string;
      if (search) {
          url = `${API_BASE}/products/search?search_str=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;
      } else {
          const q = new URLSearchParams();
          q.set("page", String(page));
          q.set("limit", String(limit));
          if (selectedCategory) q.set("category", selectedCategory);
          if (sort) q.set("sort", sort);
          url = `${API_BASE}/products?${q.toString()}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data.products || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
      showToast("Could not load products. Please check connection.");
    } finally { setLoading(false); }
  }

  // --- CART & CHECKOUT LOGIC ---
  function addToCart(product: Product, quantity = 1) {
    if (product.stock !== undefined && product.stock <= 0) {
        showToast("Out of stock");
        return;
    }
    setCart(prev => {
        const next = [...prev];
        const idx = next.findIndex(x => x.product_id === product.id);
        if (idx >= 0) {
            next[idx].quantity += quantity;
        } else {
            next.push({ 
                product_id: product.id, 
                title: product.title, 
                price: product.price, 
                image: product.thumbnail || (product.images && product.images[0]) || "", 
                quantity 
            });
        }
        return next;
    });
    showToast(`${product.title} added to cart!`);
    setCartOpen(true);
  }

  function changeQty(product_id: number, qty: number) {
    setCart(prev => prev.map(it => it.product_id === product_id ? { ...it, quantity: Math.max(1, qty) } : it));
  }

  function removeFromCart(product_id: number) {
    setCart(prev => prev.filter(it => it.product_id !== product_id));
  }
  
  async function checkout() {
    if (!cart.length) { showToast("Cart is empty"); return; }
    if (!token) {
        showToast(`Simulated checkout: Total ₹${(cart.reduce((s, i) => s + i.price * i.quantity, 0)).toFixed(2)}`);
        setCart([]);
        setCartOpen(false);
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/cart/checkout`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } 
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Checkout failed: ${res.status}`);
        }
        const body = await res.json();
        showToast(`Order placed successfully! Total: ₹${body.total}`);
        setCart([]);
        setCartOpen(false);
    } catch (e: any) {
        showToast(String(e.message || e));
    }
  }

  // --- AUTHENTICATION LOGIC ---
  function logout() {
    setToken("");
    setUser("");
    showToast("You've been logged out.");
  }

  async function handleAuth(mode: 'login' | 'register', email: string, username: string, password: string) {
    try {
      const url = `${API_BASE}/users/${mode}`;
      const body = mode === "login" ? { email, password } : { email, username, password };
      const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
      });
      if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Authentication failed");
      }
      const data = await res.json();
      if (mode === "login") {
          setToken(data.access_token);
          setUser(data.username || email);
          showToast("Login successful!");
          setAuthModal(false);
      } else {
          showToast("Registered successfully! Please login.");
      }
    } catch (e: any) {
      showToast(e.message);
    }
  }
  
  // --- UI HELPERS ---
  const formatPrice = (p?: number) => `₹${(p || 0).toFixed(2)}`;
  
  function showToast(message: string) {
    setUiMessage(message);
    setTimeout(() => setUiMessage(null), 3000);
  }
  
  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) rec.stop();
    else {
      try { rec.start(); } catch {}
    }
  };
  
  const handleCategorySelect = (category: string) => {
    // If the same category is clicked again, deselect it
    if (selectedCategory === category) {
      setSelectedCategory("");
    } else {
      setSelectedCategory(category); 
    }
    setPage(1);
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  };


  // --- RENDER ---
  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      <Header
        user={user}
        onLoginClick={() => setAuthModal(true)}
        onLogoutClick={logout}
        onCartClick={() => setCartOpen(true)}
        cartItemCount={cart.length}
      />
      
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Slider />
        
        <CategoryCarousel 
          categories={categories}
          onCategorySelect={handleCategorySelect}
          selectedCategory={selectedCategory}
        />
        
        <div id="products-section" className="py-12 max-w-7xl mx-auto">
           <h2 className="text-3xl font-bold text-center mb-2">Our Products</h2>
           <p className="text-center text-gray-500 mb-8">
             {selectedCategory ? `Showing products in "${selectedCategory.replace(/-/g, ' ')}"` : 'Discover our curated selection of high-quality products.'}
           </p>
           
           <ProductFilters
             search={search}
             setSearch={setSearch}
             toggleMic={toggleMic}
             listening={listening}
             micSupported={micSupported}
             categories={categories}
             selectedCategory={selectedCategory}
             setSelectedCategory={(c: string) => {setSelectedCategory(c); setPage(1);}}
             sort={sort}
             setSort={(s: string) => {setSort(s); setPage(1);}}
           />

           {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
               {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
             </div>
           ) : products.length === 0 ? (
             <div className="text-center py-16 bg-gray-50 rounded-lg mt-8">
                <h3 className="text-xl font-semibold">No Products Found</h3>
                <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
               {products.map(p => (
                 <ProductCard
                   key={p.id}
                   product={p}
                   onViewClick={() => setSelectedProduct(p)}
                   onAddClick={() => addToCart(p)}
                   formatPrice={formatPrice}
                 />
               ))}
             </div>
           )}

           <Pagination
             page={page}
             pages={pages}
             onPageChange={setPage}
           />
        </div>

        <div className="max-w-7xl mx-auto">
            <BrandLogos/>
        </div>
      </main>

      <Footer />

      {/* Modals & Drawers */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          formatPrice={formatPrice}
        />
      )}

      <CartSheet
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        changeQty={changeQty}
        removeFromCart={removeFromCart}
        checkout={checkout}
        formatPrice={formatPrice}
      />
      
      {authModal && <AuthDialog onClose={() => setAuthModal(false)} handleAuth={handleAuth} />}
      
      {uiMessage && <Toast message={uiMessage} onDismiss={() => setUiMessage(null)} />}
    </div>
  );
}


// --- SUB-COMPONENTS ---

const Header = ({ user, onLoginClick, onLogoutClick, onCartClick, cartItemCount }: {
  user: string;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = ["Catalogue", "Fashion", "Favourite", "Lifestyle"];

  return (
    <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <a href="#" className="text-2xl font-bold tracking-wider">FASHION</a>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map(link => (
              <a key={link} href="#" className="text-gray-600 hover:text-black transition-colors duration-200">{link}</a>
            ))}
          </nav>
          <div className="flex items-center space-x-4">
             {user ? (
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 flex items-center justify-center bg-black text-white font-bold rounded-full text-lg">
                    {user.trim().charAt(0).toUpperCase()}
                 </div>
                 <button onClick={onLogoutClick} className="hidden lg:block text-sm bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors">Logout</button>
               </div>
             ) : (
                <button onClick={onLoginClick} className="hidden md:block bg-black text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-transform hover:scale-105">SIGN UP</button>
             )}
             <button onClick={onCartClick} className="relative p-2 rounded-full hover:bg-gray-100">
                <ShoppingCart className="h-6 w-6"/>
                {cartItemCount > 0 && <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-yellow-400 text-black text-xs font-bold text-center leading-5">{cartItemCount}</span>}
             </button>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              <Menu className="h-6 w-6"/>
            </button>
          </div>
        </div>
      </div>
       {menuOpen && (
          <div className="md:hidden bg-white py-4 px-4 space-y-2">
             {navLinks.map(link => (
              <a key={link} href="#" className="block text-gray-600 hover:text-black transition-colors duration-200 py-2">{link}</a>
            ))}
             {!user && <button onClick={()=>{onLoginClick(); setMenuOpen(false);}} className="w-full bg-black text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-800">SIGN UP</button>}
          </div>
        )}
    </header>
  )
};

// --- REVISED SLIDER COMPONENT ---
const slides = [
  { id: 1, title: "Summer Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-yellow-50 to-pink-50" },
  { id: 2, title: "Winter Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1021693/pexels-photo-1021693.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-pink-50 to-blue-50" },
  { id: 3, title: "Spring Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-blue-50 to-yellow-50" },
  { id: 4, title: "Electronics Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/3804415/pexels-photo-3804415.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-teal-50 to-cyan-50" },
  { id: 5, title: "Healthy Fruits Collections", description: "Sale! Up to 20% off!", img: "https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-green-50 to-lime-50" },
];

const Slider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[calc(80vh)] my-8 rounded-3xl overflow-hidden">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className={`${slide.bg} flex-shrink-0 w-full h-full flex flex-col md:flex-row`}>
            {/* TEXT CONTAINER */}
            <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-center gap-8 text-center p-4">
              <h2 className="text-2xl lg:text-3xl font-medium">{slide.description}</h2>
              <h1 className="text-4xl lg:text-6xl font-semibold">{slide.title}</h1>
              <a href="#products-section">
                <button className="rounded-md bg-black text-white py-3 px-6 font-semibold hover:bg-gray-800 transition-colors">
                  SHOP NOW
                </button>
              </a>
            </div>
            {/* IMAGE CONTAINER */}
            <div className="w-full md:w-1/2 h-full relative">
              <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute m-auto left-1/2 bottom-8 flex gap-4 -translate-x-1/2">
        {slides.map((_, index) => (
          <div
            key={index}
            onClick={() => setCurrent(index)}
            className={`w-3 h-3 rounded-full ring-1 ring-gray-600 cursor-pointer transition-all ${
              current === index ? "scale-150 bg-gray-700" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};


// --- UPDATED CATEGORY COMPONENT (NO CAROUSEL) ---
const CategoryCarousel = ({ categories, onCategorySelect, selectedCategory }: {
  categories: string[];
  onCategorySelect: (category: string) => void;
  selectedCategory: string | null;
}) => {
    if (!categories || categories.length === 0) {
        return null;
    }

    return (
        <div className="py-12">
            <h2 className="text-3xl font-bold text-center mb-8">Explore Our Collections</h2>
            <div className="relative w-full">
                <div className="flex p-4 gap-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {/* This parent div will manage the hover effect for all children */}
                    <div className="flex gap-5 group">
                        {categories.map((category) => (
                            <div
                                key={category}
                                onClick={() => onCategorySelect(category)}
                                className={`flex-shrink-0 w-60 cursor-pointer transition-all duration-500 ease-in-out
                                  ${selectedCategory && selectedCategory !== category ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
                                  group-hover:opacity-50 group-hover:scale-95 hover:!opacity-100 hover:!scale-105 hover:-translate-y-4
                                `}
                            >
                                <div className={`relative h-[28rem] w-full bg-gray-200 overflow-hidden transition-all duration-300
                                  ${selectedCategory === category ? 'ring-4 ring-black ring-offset-4' : ''}
                                `}>
                                    <img
                                        src={`/pics/${category}.jpg`}
                                        alt={category}
                                        className="w-full h-full object-cover"
                                        onError={(e: any) => e.target.src = `https://placehold.co/400x600/e2e8f0/334155?text=${category}`}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                    <h3 className="absolute bottom-5 left-5 text-2xl font-bold text-white capitalize">
                                        {category.replace(/-/g, ' ')}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const ProductFilters = ({ search, setSearch, toggleMic, listening, micSupported, categories, selectedCategory, setSelectedCategory, sort, setSort }: any) => (
  <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="relative w-full md:w-auto md:flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for products..."
        className="w-full border rounded-lg pl-10 pr-12 py-2 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition"
      />
       <button
          type="button"
          onClick={toggleMic}
          disabled={!micSupported}
          title={!micSupported ? "Voice search not supported" : "Search with voice"}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${listening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-black'} ${!micSupported && 'cursor-not-allowed text-gray-300'}`}
        >
          <Mic className="h-5 w-5"/>
       </button>
    </div>
    <div className="flex items-center gap-4 w-full md:w-auto">
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full md:w-auto border rounded-lg px-3 py-2 bg-white cursor-pointer focus:ring-2 focus:ring-yellow-400 outline-none">
          <option value="">All Categories</option>
          {categories.map((c:string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full md:w-auto border rounded-lg px-3 py-2 bg-white cursor-pointer focus:ring-2 focus:ring-yellow-400 outline-none">
          <option value="id">Default</option>
          <option value="-price">Price: High-Low</option>
          <option value="price">Price: Low-High</option>
          <option value="-rating">Rating</option>
        </select>
    </div>
  </div>
);

const ProductCard = ({ product, onViewClick, onAddClick, formatPrice }: {
  product: Product;
  onViewClick: () => void;
  onAddClick: () => void;
  formatPrice: (p: number) => string;
}) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
    <div className="relative aspect-square mb-4 overflow-hidden rounded-xl">
       <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110" 
       onError={(e:any) => e.target.src=`https://placehold.co/300x300/e2e8f0/334155?text=${product.title.split(' ').join('+')}`}/>
       <button className="absolute top-2 right-2 bg-white/70 backdrop-blur-sm p-2 rounded-full text-gray-600 hover:text-red-500 transition-colors">
         <Heart className="h-5 w-5"/>
       </button>
    </div>
    <div className="flex-1 mb-4">
      <h3 className="font-semibold text-base truncate" title={product.title}>{product.title}</h3>
      <p className="text-xs text-gray-500">{product.category}</p>
    </div>
    <div className="flex items-center justify-between">
      <div>
        <div className="text-lg font-bold">{formatPrice(product.price)}</div>
        <div className="text-xs text-yellow-600 flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400"/> {product.rating.toFixed(1)}</div>
      </div>
      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={onViewClick} className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 text-sm rounded-lg transition-colors">View</button>
        <button onClick={onAddClick} className="bg-black text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-800 transition-colors">Add</button>
      </div>
    </div>
  </div>
);

const ProductCardSkeleton = () => (
  <div className="bg-gray-100 rounded-2xl p-4 animate-pulse">
    <div className="aspect-square mb-4 bg-gray-200 rounded-xl"></div>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
    <div className="flex items-center justify-between">
       <div className="h-6 bg-gray-200 rounded w-1/4"></div>
       <div className="h-8 bg-gray-200 rounded-lg w-1/3"></div>
    </div>
  </div>
);

const Pagination = ({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (p: number) => void; }) => (
  <div className="mt-10 flex items-center justify-center gap-2">
    <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
    <span className="text-sm text-gray-600">Page {page} of {pages}</span>
    <button onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages} className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
  </div>
);

const BrandLogos = () => {
    const logos = [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/H%26M-Logo.svg/1280px-H%26M-Logo.svg.png",
        "https://upload.wikimedia.org/wikipedia/commons/a/a6/Calvin_klein_logo_web23.svg",
        "https://upload.wikimedia.org/wikipedia/commons/0/00/Samsung_Orig_Wordmark_BLACK_RGB.png",
        "https://upload.wikimedia.org/wikipedia/commons/0/02/Levi%27s_logo_%282011%29.svg",
        "https://upload.wikimedia.org/wikipedia/commons/c/c5/Gucci_logo.svg"
    ];
    return (
        <div className="py-12 border-t border-gray-100">
            <div className="max-w-5xl mx-auto flex justify-around items-center gap-8 flex-wrap">
                {logos.map((logo, i) => (
                    <img key={i} src={logo} alt={`Brand ${i}`} className="h-8 object-contain" style={{filter: 'grayscale(100%)', opacity: 0.6}}/>
                ))}
            </div>
        </div>
    );
};

const Footer = () => (
    <footer className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="bg-yellow-400 text-black p-10 rounded-2xl text-center mb-16">
                <h2 className="text-3xl font-bold">JOIN SHOPPING COMMUNITY TO GET MONTHLY PROMO</h2>
                <p className="mt-2 text-gray-800">Type your email down below and be young wild generation</p>
                <form className="mt-6 max-w-md mx-auto flex">
                    <input type="email" placeholder="Add your email here" className="flex-1 rounded-l-lg px-4 py-3 border-black outline-none"/>
                    <button type="submit" className="bg-black text-white px-6 py-3 rounded-r-lg font-semibold">SEND</button>
                </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    <h3 className="text-2xl font-bold">FASHION</h3>
                    <p className="mt-4 text-gray-400">Complete your style with awesome clothes from us.</p>
                </div>
                <div>
                    <h4 className="font-semibold">Company</h4>
                    <ul className="mt-4 space-y-2 text-gray-400">
                        <li><a href="#" className="hover:text-white">About</a></li>
                        <li><a href="#" className="hover:text-white">Contact us</a></li>
                        <li><a href="#" className="hover:text-white">Support</a></li>
                        <li><a href="#" className="hover:text-white">Careers</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold">Quick Link</h4>
                    <ul className="mt-4 space-y-2 text-gray-400">
                        <li><a href="#" className="hover:text-white">Orders Tracking</a></li>
                        <li><a href="#" className="hover:text-white">Size Guide</a></li>
                        <li><a href="#" className="hover:text-white">FAQs</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold">Legal</h4>
                    <ul className="mt-4 space-y-2 text-gray-400">
                        <li><a href="#" className="hover:text-white">Terms & conditions</a></li>
                        <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
);

const ProductDetailDialog = ({ product, onClose, onAddToCart, formatPrice }: {
  product: Product;
  onClose: () => void;
  onAddToCart: (p: Product, q: number) => void;
  formatPrice: (p: number) => string;
}) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-lg relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black p-2 rounded-full bg-gray-100 z-10"><X size={20}/></button>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
             <img src={product.images?.[0] || product.thumbnail} alt={product.title} className="w-full h-auto aspect-square object-cover rounded-xl" />
          </div>
          <div>
            <span className="text-sm bg-yellow-100 text-yellow-800 font-medium px-2 py-1 rounded">{product.category}</span>
            <h2 className="text-3xl font-bold mt-2">{product.title}</h2>
            <p className="text-gray-500 text-sm mt-1">{product.brand}</p>
            <div className="flex items-center gap-2 mt-4">
               <div className="flex items-center gap-1 text-yellow-500">
                   {[...Array(5)].map((_, i) => <Star key={i} size={20} className={i < Math.round(product.rating) ? "fill-current" : "text-gray-300"} />)}
               </div>
               <span className="text-gray-600 font-semibold">{product.rating.toFixed(1)}</span>
            </div>
            <p className="text-sm text-gray-700 my-4">{product.description}</p>
            <div className="text-3xl font-bold my-6">{formatPrice(product.price)}</div>
            <div className="flex items-center gap-4">
                <div className="flex items-center border rounded-lg">
                    <button onClick={() => setQuantity(q => Math.max(1, q-1))} className="px-3 py-2 text-gray-600"><Minus size={16}/></button>
                    <span className="px-4 py-2 font-semibold">{quantity}</span>
                    <button onClick={() => setQuantity(q => q+1)} className="px-3 py-2 text-gray-600"><Plus size={16}/></button>
                </div>
                <button 
                  onClick={() => onAddToCart(product, quantity)} 
                  className="flex-1 bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-transform hover:scale-105"
                >
                  Add to Cart
                </button>
            </div>
            <div className="text-sm mt-4 text-green-600 font-medium">In Stock: {product.stock} items</div>
          </div>
        </div>
      </div>
    </div>
  )
};

const CartSheet = ({ isOpen, onClose, cart, changeQty, removeFromCart, checkout, formatPrice }: {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  changeQty: (id: number, qty: number) => void;
  removeFromCart: (id: number) => void;
  checkout: () => void;
  formatPrice: (p: number) => string;
}) => (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'bg-black/40' : 'bg-transparent pointer-events-none'}`}>
        <div 
          onClick={onClose} 
          className={`absolute inset-0 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-xl font-bold">Shopping Cart</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X size={20}/></button>
                </div>
                {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <ShoppingCart size={48} className="text-gray-300 mb-4"/>
                        <h4 className="font-semibold text-lg">Your cart is empty</h4>
                        <p className="text-gray-500">Looks like you haven't added anything yet.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {cart.map(it => (
                            <div key={it.product_id} className="flex items-start gap-4">
                                <img src={it.image} alt={it.title} className="w-20 h-20 object-cover rounded-lg"/>
                                <div className="flex-1">
                                    <h4 className="font-semibold">{it.title}</h4>
                                    <p className="text-sm text-gray-500">{formatPrice(it.price)}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input type="number" min="1" value={it.quantity} onChange={e => changeQty(it.product_id, Number(e.target.value || 1))} className="w-16 border rounded-md px-2 py-1 text-center"/>
                                        <button onClick={() => removeFromCart(it.product_id)} className="text-sm text-red-500 hover:underline">Remove</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="p-6 border-t bg-gray-50">
                    <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Subtotal</span>
                        <span>{formatPrice(cart.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                    </div>
                    <button onClick={checkout} disabled={cart.length === 0} className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const AuthDialog = ({ onClose, handleAuth }: { onClose: () => void; handleAuth: (m: 'login' | 'register', e: string, u: string, p: string) => Promise<void> }) => {
    const [mode, setMode] = useState<'login' | 'register'>("login");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await handleAuth(mode, email, username, password);
        setLoading(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-lg">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-black hover:bg-gray-100"><X size={20}/></button>
                <h2 className="text-2xl font-bold mb-2 text-center">{mode === 'login' ? 'Welcome Back!' : 'Create an Account'}</h2>
                <p className="text-gray-500 mb-6 text-center">{mode === 'login' ? 'Login to continue shopping' : 'Sign up to get started'}</p>
                <form onSubmit={submit} className="space-y-4">
                    {mode === 'register' && <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full border rounded-lg px-4 py-2" required />}
                    <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg px-4 py-2" required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-4 py-2" required />
                    <button type="submit" disabled={loading} className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-70">{loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Register')}</button>
                </form>
                <div className="text-center text-sm text-gray-500 mt-4">
                    {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button className="font-semibold text-black hover:underline" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>
                        {mode === 'login' ? 'Register' : 'Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, onDismiss }: { message: string; onDismiss: () => void; }) => (
    <div className="fixed right-6 bottom-6 bg-black text-white p-4 rounded-lg shadow-lg animate-toast-in">
        <span>{message}</span>
        <button onClick={onDismiss} className="ml-4 font-bold opacity-70 hover:opacity-100">×</button>
    </div>
);