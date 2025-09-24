import React, { ElementType, useEffect, useState, useCallback, useRef, useMemo, createElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { gsap } from "gsap"; // <-- ADD THIS IMPORT FOR THE TEXT ANIMATION

// --- ICONS ---
import { X, ShoppingCart, Star, Minus, Plus, LogOut, Loader2, ArrowRight, ChevronLeft, ChevronRight, Search, Heart, Menu, Mic, Sun, Moon, User, Package, Settings } from "lucide-react";

// ======================================================================
// --- 1. TYPES & CONSTANTS ---
// ======================================================================

interface Product {
  id: number; title: string; description: string; price: number; rating: number; stock: number; brand: string; category: string; thumbnail: string; images: string[];
}
interface CartItem {
  product_id: number; title: string; price: number; image: string; quantity: number;
}
const API_BASE = "https://backfinal-7pi0.onrender.com";

// ======================================================================
// --- 2. API WRAPPER with Token Refresh Logic ---
// ======================================================================

const api = {
  async request(method: string, endpoint: string, body: any = null) {
    let accessToken = localStorage.getItem("accessToken");
    const makeRequest = async (token: string | null) => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const options: RequestInit = { method, headers };
      if (body) options.body = JSON.stringify(body);
      return fetch(`${API_BASE}${endpoint}`, options);
    };
    let res = await makeRequest(accessToken);
    if (res.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) { this.logout(); throw new Error("Session expired. Please log in again."); }
      try {
        const refreshRes = await fetch(`${API_BASE}/users/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) });
        if (!refreshRes.ok) throw new Error("Session expired.");
        const data = await refreshRes.json();
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("refreshToken", data.refresh_token);
        res = await makeRequest(data.access_token);
      } catch (error) { this.logout(); throw new Error("Session expired. Please log in again."); }
    }
    return res;
  },
  async get(endpoint: string) { return this.request('GET', endpoint); },
  async post(endpoint: string, body: any) { return this.request('POST', endpoint, body); },
  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("authChange"));
  }
};

// ======================================================================
// --- 3. CUSTOM HOOKS ---
// ======================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function useTheme() {
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        return savedTheme || 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            root.classList.add(systemIsDark ? 'dark' : 'light');
        } else {
            root.classList.add(theme);
        }
        
        localStorage.setItem("theme", theme);
    }, [theme]);

    return [theme, setTheme] as const;
}

// ======================================================================
// --- 4. UI SUB-COMPONENTS (DEFINED BEFORE APP) ---
// ======================================================================

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-gray-200 bg-white hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800",
        ghost: "hover:bg-gray-100 dark:hover:bg-gray-800",
      },
      size: { default: "h-11 px-6 py-2", lg: "h-12 rounded-xl px-8 text-base" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);

const Dialog = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" onClick={onClose} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ ease: "easeOut", duration: 0.2 }} className="relative z-10">
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
);

const Sheet = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; }) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-950 shadow-xl flex flex-col">
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
);

const ImageWithLoader = ({ src, alt, className }: { src: string; alt: string; className: string; }) => {
    const [isLoading, setIsLoading] = useState(true);
    return (
        <div className={cn("relative overflow-hidden", className)}>
            <AnimatePresence>{isLoading && <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse" />}</AnimatePresence>
            <img src={src} alt={alt} className={cn("w-full h-full object-cover transition-opacity duration-300", isLoading ? 'opacity-0' : 'opacity-100')} onLoad={() => setIsLoading(false)} onError={(e: any) => {e.target.src = `https://placehold.co/600x800/e2e8f0/334155?text=Image+Not+Found`; setIsLoading(false)}}/>
        </div>
    );
};


// --- START: New ImageZoom Component ---
const ImageZoom = ({ src, alt }: { src: string; alt: string; }) => {
    const [showZoom, setShowZoom] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const imgRef = useRef<HTMLImageElement>(null);
    const lensSize = 150;
    const zoomLevel = 2.5;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imgRef.current) return;
        const { left, top, width, height } = imgRef.current.getBoundingClientRect();
        let x = e.clientX - left;
        let y = e.clientY - top;

        // Keep the lens inside the image bounds
        if (x > width - (lensSize / 2)) x = width - (lensSize / 2);
        if (x < (lensSize / 2)) x = (lensSize / 2);
        if (y > height - (lensSize / 2)) y = height - (lensSize / 2);
        if (y < (lensSize / 2)) y = (lensSize / 2);
        
        setMousePos({ x, y });
    };

    const lensX = mousePos.x - (lensSize / 2);
    const lensY = mousePos.y - (lensSize / 2);
    const bgPosX = -(mousePos.x * zoomLevel - lensSize * 1.25);
    const bgPosY = -(mousePos.y * zoomLevel - lensSize * 1.25);

    return (
        <div 
            className="relative w-full aspect-square"
            onMouseEnter={() => !isLoading && setShowZoom(true)}
            onMouseLeave={() => setShowZoom(false)}
            onMouseMove={handleMouseMove}
        >
            <AnimatePresence>{isLoading && <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />}</AnimatePresence>
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className={cn("w-full h-full object-cover rounded-xl transition-opacity duration-300", isLoading ? 'opacity-0' : 'opacity-100')}
                onLoad={() => setIsLoading(false)}
            />

            <AnimatePresence>
            {showZoom && (
                <>
                    {/* The Lens */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute pointer-events-none rounded-lg border-2 border-white bg-white/20 backdrop-blur-sm"
                        style={{
                            width: lensSize,
                            height: lensSize,
                            top: lensY,
                            left: lensX
                        }}
                    />
                    {/* The Zoomed View */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-0 left-[105%] h-full w-full pointer-events-none hidden md:block bg-no-repeat border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900"
                        style={{
                            backgroundImage: `url(${src})`,
                            backgroundSize: `${(imgRef.current?.width || 0) * zoomLevel}px ${(imgRef.current?.height || 0) * zoomLevel}px`,
                            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                        }}
                    />
                </>
            )}
            </AnimatePresence>
        </div>
    );
};
// --- END: New ImageZoom Component ---


// --- START: New TextType Animation Component ---
interface TextTypeProps {
  className?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: string | React.ReactNode;
  cursorBlinkDuration?: number;
  cursorClassName?: string;
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
}

const TextType = ({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}: TextTypeProps & React.HTMLAttributes<HTMLElement>) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return 'inherit'; // Changed to inherit color
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;
    const observer = new IntersectionObserver( entries => { entries.forEach(entry => { if (entry.isIntersecting) { setIsVisible(true); } }); }, { threshold: 0.1 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (showCursor && cursorRef.current) {
      gsap.set(cursorRef.current, { opacity: 1 });
      gsap.to(cursorRef.current, { opacity: 0, duration: cursorBlinkDuration, repeat: -1, yoyo: true, ease: 'power2.inOut' });
    }
  }, [showCursor, cursorBlinkDuration]);

  useEffect(() => {
    if (!isVisible) return;
    let timeout: NodeJS.Timeout;
    const currentText = textArray[currentTextIndex];
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText;
    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false);
          if (currentTextIndex === textArray.length - 1 && !loop) return;
          if (onSentenceComplete) { onSentenceComplete(textArray[currentTextIndex], currentTextIndex); }
          setCurrentTextIndex(prev => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
        } else {
          timeout = setTimeout(() => { setDisplayedText(prev => prev.slice(0, -1)); }, deletingSpeed);
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout( () => {
              setDisplayedText(prev => prev + processedText[currentCharIndex]);
              setCurrentCharIndex(prev => prev + 1);
            }, variableSpeed ? getRandomSpeed() : typingSpeed );
        } else if (textArray.length > 1 || loop) {
          timeout = setTimeout(() => { setIsDeleting(true); }, pauseDuration);
        }
      }
    };
    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timeout = setTimeout(executeTypingAnimation, initialDelay);
    } else {
      executeTypingAnimation();
    }
    return () => clearTimeout(timeout);
  }, [currentCharIndex, displayedText, isDeleting, typingSpeed, deletingSpeed, pauseDuration, textArray, currentTextIndex, loop, initialDelay, isVisible, reverseMode, variableSpeed, onSentenceComplete, getRandomSpeed ]);

  const shouldHideCursor = hideCursorWhileTyping && (currentCharIndex < textArray[currentTextIndex].length || isDeleting);

  return createElement(
    Component,
    { ref: containerRef, className: `whitespace-pre-wrap ${className}`, ...props },
    <span className="inline" style={{ color: getCurrentTextColor() }}>
      {displayedText}
    </span>,
    showCursor && ( <span ref={cursorRef} className={`ml-1 inline-block ${shouldHideCursor ? 'hidden' : ''} ${cursorClassName}`} >
        {cursorCharacter}
      </span>
    )
  );
};
// --- END: New TextType Animation Component ---


const Header = ({ user, onLoginClick, onLogoutClick, onCartClick, onWishlistClick, onProfileClick, cartItemCount, wishlistItemCount, theme, setTheme }: { user: string | null; onLoginClick: () => void; onLogoutClick: () => void; onCartClick: () => void; onWishlistClick: () => void; onProfileClick: () => void; cartItemCount: number; wishlistItemCount: number; theme: string; setTheme: (theme: string) => void; }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const navLinks = ["Catalogue", "Fashion", "Favourite", "Lifestyle"];

  const [effectiveTheme, setEffectiveTheme] = useState('light');
  useEffect(() => {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setEffectiveTheme(theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme);
  }, [theme]);


  return (
    <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <a href="#" className="text-2xl font-bold tracking-wider text-gray-900 dark:text-white">FASHION</a>
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map(link => (<a key={link} href="#" className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">{link}</a>))}
          </nav>
          <div className="flex items-center space-x-1">
            <Button onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')} variant="ghost" className="relative p-2 h-auto rounded-full">
                {effectiveTheme === 'dark' ? <Sun/> : <Moon/>}
            </Button>
            <Button onClick={onWishlistClick} variant="ghost" className="relative p-2 h-auto rounded-full">
              <Heart />
              {wishlistItemCount > 0 && <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-yellow-400 text-black text-xs font-bold text-center leading-5">{wishlistItemCount}</span>}
            </Button>
            <Button onClick={onCartClick} variant="ghost" className="relative p-2 h-auto rounded-full">
              <ShoppingCart />
              {cartItemCount > 0 && <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-yellow-400 text-black text-xs font-bold text-center leading-5">{cartItemCount}</span>}
            </Button>
            {user ? (
              <div className="relative">
                <button onClick={() => setProfileDropdownOpen(o => !o)} className="w-10 h-10 ml-2 flex items-center justify-center bg-gray-900 dark:bg-gray-50 text-white dark:text-gray-900 font-bold rounded-full text-lg">{user.trim().charAt(0).toUpperCase()}</button>
                <AnimatePresence>
                {profileDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg p-1.5">
                      <p className="px-3 py-2 font-semibold text-gray-900 dark:text-white truncate text-sm">{user}</p>
                      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                      <button onClick={() => { onProfileClick(); setProfileDropdownOpen(false); }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"><User size={16} /> My Profile</button>
                      <button onClick={onLogoutClick} className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"><LogOut size={16} /> Logout</button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            ) : (<Button onClick={onLoginClick} className="hidden md:block ml-2">SIGN UP</Button>)}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden bg-white dark:bg-gray-950 overflow-hidden">
            <div className="py-4 px-4 space-y-2 border-t dark:border-gray-800">
              {navLinks.map(link => (<a key={link} href="#" className="block text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-md px-3 py-2">{link}</a>))}
              {!user && <Button onClick={() => { onLoginClick(); setMenuOpen(false); }} className="w-full mt-2">SIGN UP</Button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
};

const slides = [
  { id: 1, title: "Summer Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-yellow-50 to-pink-50" },
  { id: 2, title: "Winter Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1021693/pexels-photo-1021693.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-pink-50 to-blue-50" },
  { id: 3, title: "Spring Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-blue-50 to-yellow-50" },
  { id: 4, title: "Electronics Sale Collections", description: "Sale! Up to 50% off!", img: "https://images.pexels.com/photos/3804415/pexels-photo-3804415.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-teal-50 to-cyan-50" },
  { id: 5, title: "Healthy Fruits Collections", description: "Sale! Up to 20% off!", img: "https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb", bg: "bg-gradient-to-r from-green-50 to-lime-50" },
];

// --- MODIFIED: Slider component updated to use TextType for animation ---
const Slider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 8000); // Increased interval to allow animation to complete
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[calc(80vh)] my-8 rounded-3xl overflow-hidden">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className={`${slide.bg} flex-shrink-0 w-full h-full flex flex-col md:flex-row text-gray-800`}>
            {/* TEXT CONTAINER */}
            <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-center gap-4 text-center p-4">
               {/* --- MODIFIED: Replaced static text with TextType animation --- */}
               {current === index && (
                <TextType
                  as="h1"
                  text={[slide.description, slide.title]}
                  typingSpeed={75}
                  deletingSpeed={40}
                  pauseDuration={1500}
                  className="text-5xl lg:text-7xl font-extrabold text-shadow"
                />
              )}
              <a href="#products-section">
                <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.5, duration: 0.5}}>
                  <button className="rounded-md bg-black text-white py-3 px-6 font-semibold hover:bg-gray-800 transition-colors">
                    SHOP NOW
                  </button>
                </motion.div>
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

const CategoryCarousel = ({ categories, onCategorySelect, selectedCategory }: { categories: string[]; onCategorySelect: (category: string) => void; selectedCategory: string | null; }) => {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="py-12">
      <h2 className="text-3xl font-bold text-center mb-8 dark:text-white">Explore Our Collections</h2>
      <div className="flex p-4 gap-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-5 group mx-auto">
          <div onClick={() => onCategorySelect("")} className={`flex-shrink-0 w-60 cursor-pointer transition-all duration-500 ease-in-out ${selectedCategory && selectedCategory !== "" ? 'opacity-50 scale-95' : 'opacity-100 scale-100'} group-hover:opacity-50 group-hover:scale-95 hover:!opacity-100 hover:!scale-105 hover:-translate-y-4`}>
              <div className={`relative h-[28rem] w-full bg-gray-200 overflow-hidden transition-all duration-300 rounded-2xl ${selectedCategory === "" || selectedCategory === null ? 'ring-4 ring-gray-900 dark:ring-yellow-400 ring-offset-4 ring-offset-gray-50 dark:ring-offset-gray-950' : ''}`}>
                  <ImageWithLoader src={`/images/all.jpg`} alt="All Products" className="w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                  <h3 className="absolute bottom-5 left-5 text-2xl font-bold text-white capitalize">All Products</h3>
              </div>
          </div>
          {categories.map((category) => (
            <div key={category} onClick={() => onCategorySelect(category)} className={`flex-shrink-0 w-60 cursor-pointer transition-all duration-500 ease-in-out ${selectedCategory && selectedCategory !== category ? 'opacity-50 scale-95' : 'opacity-100 scale-100'} group-hover:opacity-50 group-hover:scale-95 hover:!opacity-100 hover:!scale-105 hover:-translate-y-4`}>
              <div className={`relative h-[28rem] w-full bg-gray-200 overflow-hidden transition-all duration-300 rounded-2xl ${selectedCategory === category ? 'ring-4 ring-gray-900 dark:ring-yellow-400 ring-offset-4 ring-offset-gray-50 dark:ring-offset-gray-950' : ''}`}>
                <ImageWithLoader src={`/public/${category}.jpg`} alt={category} className="w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <h3 className="absolute bottom-5 left-5 text-2xl font-bold text-white capitalize">{category.replace(/-/g, ' ')}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProductFilters = ({ search, setSearch, toggleMic, listening, micSupported, sort, setSort }: any) => (
  <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
    <div className="relative w-full md:w-auto md:flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for products..." className="w-full border dark:border-gray-700 bg-transparent rounded-lg pl-10 pr-12 py-2.5 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition" />
      <button type="button" onClick={toggleMic} disabled={!micSupported} title={!micSupported ? "Voice search not supported" : "Search with voice"} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${listening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-black dark:hover:text-white'} ${!micSupported && 'cursor-not-allowed text-gray-300'}`}>
        <Mic className="h-5 w-5"/>
      </button>
    </div>
    <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full md:w-auto border dark:border-gray-700 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-900 cursor-pointer focus:ring-2 focus:ring-yellow-400 outline-none">
      <option value="id">Default Sorting</option>
      <option value="-price">Price: High to Low</option>
      <option value="price">Price: Low to High</option>
      <option value="-rating">Sort by Rating</option>
    </select>
  </div>
);

const ProductCard = ({ product, onViewClick, onAddClick, onWishlistClick, isInWishlist, formatPrice }: { product: Product; onViewClick: () => void; onAddClick: () => void; onWishlistClick: () => void; isInWishlist: boolean; formatPrice: (p: number) => string; }) => (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
      <div className="relative aspect-[4/5] mb-4 overflow-hidden rounded-xl cursor-pointer" onClick={onViewClick}>
        <ImageWithLoader src={product.thumbnail} alt={product.title} className="w-full h-full rounded-xl transition-transform duration-300 group-hover:scale-110"/>
        <button onClick={(e) => { e.stopPropagation(); onWishlistClick(); }} className="absolute top-2 right-2 bg-white/70 dark:bg-gray-950/70 backdrop-blur-sm p-2 rounded-full text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors">
          <Heart className={`h-5 w-5 ${isInWishlist ? 'text-red-500 fill-current' : ''}`}/>
        </button>
      </div>
      <div className="flex-1 mb-4">
        <h3 className="font-semibold text-base truncate" title={product.title}>{product.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{product.category}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-bold">{formatPrice(product.price)}</div>
          <div className="text-xs text-yellow-600 flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400"/> {product.rating.toFixed(1)}</div>
        </div>
        <Button onClick={onAddClick} className="h-10 px-4">Add</Button>
      </div>
    </div>
  );

const ProductCardSkeleton = () => (<div className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-4 animate-pulse"><div className="aspect-[4/5] mb-4 bg-gray-200 dark:bg-gray-700 rounded-xl"></div><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div><div className="flex items-center justify-between"><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div><div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3"></div></div></div>);

const Pagination = ({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (p: number) => void; }) => (
  <div className="mt-10 flex items-center justify-center gap-2">
    <Button variant="outline" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium px-4">Page {page} of {pages}</span>
    <Button variant="outline" onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages}>Next</Button>
  </div>
);

const BrandLogos = () => {
    const logos = [ "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/H%26M-Logo.svg/1280px-H%26M-Logo.svg.png", "https://upload.wikimedia.org/wikipedia/commons/a/a6/Calvin_klein_logo_web23.svg", "https://upload.wikimedia.org/wikipedia/commons/0/00/Samsung_Orig_Wordmark_BLACK_RGB.png", "https://upload.wikimedia.org/wikipedia/commons/0/02/Levi%27s_logo_%282011%29.svg", "https://upload.wikimedia.org/wikipedia/commons/c/c5/Gucci_logo.svg" ];
    return (
        <div className="py-12 border-t border-gray-100 dark:border-gray-800"><div className="max-w-5xl mx-auto flex justify-around items-center gap-8 flex-wrap">{logos.map((logo, i) => (<img key={i} src={logo} alt={`Brand ${i}`} className="h-8 object-contain dark:invert dark:brightness-0 opacity-60"/>))}</div></div>
    );
};

const Footer = () => (
    <footer className="bg-black text-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"><div className="bg-yellow-400 text-black p-10 rounded-2xl text-center mb-16"><h2 className="text-3xl font-bold">JOIN SHOPPING COMMUNITY TO GET MONTHLY PROMO</h2><p className="mt-2 text-gray-800">Type your email down below and be young wild generation</p><form className="mt-6 max-w-md mx-auto flex"><input type="email" placeholder="Add your email here" className="flex-1 rounded-l-lg px-4 py-3 border-black outline-none text-black"/><button type="submit" className="bg-black text-white px-6 py-3 rounded-r-lg font-semibold">SEND</button></form></div><div className="grid grid-cols-1 md:grid-cols-4 gap-8"><div><h3 className="text-2xl font-bold">FASHION</h3><p className="mt-4 text-gray-400">Complete your style with awesome clothes from us.</p></div><div><h4 className="font-semibold">Company</h4><ul className="mt-4 space-y-2 text-gray-400"><li><a href="#" className="hover:text-white">About</a></li><li><a href="#" className="hover:text-white">Contact us</a></li><li><a href="#" className="hover:text-white">Support</a></li><li><a href="#" className="hover:text-white">Careers</a></li></ul></div><div><h4 className="font-semibold">Quick Link</h4><ul className="mt-4 space-y-2 text-gray-400"><li><a href="#" className="hover:text-white">Orders Tracking</a></li><li><a href="#" className="hover:text-white">Size Guide</a></li><li><a href="#" className="hover:text-white">FAQs</a></li></ul></div><div><h4 className="font-semibold">Legal</h4><ul className="mt-4 space-y-2 text-gray-400"><li><a href="#" className="hover:text-white">Terms & conditions</a></li><li><a href="#" className="hover:text-white">Privacy Policy</a></li></ul></div></div></div></footer>
);

const ProductDetailDialog = ({ product, onClose, onAddToCart, onSelectRelated, formatPrice }: { product: Product; onClose: () => void; onAddToCart: (p: Product, q: number) => void; onSelectRelated: (p: Product) => void; formatPrice: (p: number) => string; }) => {
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<Product[]>([]);

  useEffect(() => {
    if (product) {
      const fetchRelated = async () => {
        try {
          const res = await fetch(`${API_BASE}/products?category=${product.category}&limit=5`);
          let data = await res.json();
          setRelated(data.products.filter((p: Product) => p.id !== product.id).slice(0, 4));
        } catch { setRelated([]); }
      };
      fetchRelated();
    }
  }, [product]);

  return (
    <Dialog isOpen={true} onClose={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full shadow-lg relative max-h-[90vh] overflow-y-auto">
            <Button variant="ghost" className="absolute top-4 right-4 h-auto p-2 rounded-full z-20" onClick={onClose}><X size={20}/></Button>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <ImageZoom src={product.images?.[0] || product.thumbnail} alt={product.title} />

                <div>
                    <span className="text-sm bg-yellow-100 text-yellow-800 font-medium px-2 py-1 rounded capitalize">{product.category.replace(/-/g, ' ')}</span>
                    <h2 className="text-3xl font-bold mt-2 dark:text-white">{product.title}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{product.brand}</p>
                    <div className="flex items-center gap-2 mt-4"><div className="flex items-center gap-1 text-yellow-500">{[...Array(5)].map((_, i) => <Star key={i} size={20} className={i < Math.round(product.rating) ? "fill-current" : "text-gray-300"} />)}</div><span className="text-gray-600 dark:text-gray-300 font-semibold">{product.rating.toFixed(1)}</span></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 my-4">{product.description}</p>
                    <div className="text-3xl font-bold my-6 dark:text-white">{formatPrice(product.price)}</div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center border dark:border-gray-700 rounded-lg"><button onClick={() => setQuantity(q => Math.max(1, q-1))} className="px-3 py-2 text-gray-600 dark:text-gray-300"><Minus size={16}/></button><span className="px-4 py-2 font-semibold">{quantity}</span><button onClick={() => setQuantity(q => q+1)} className="px-3 py-2 text-gray-600 dark:text-gray-300"><Plus size={16}/></button></div>
                        <Button onClick={() => { onAddToCart(product, quantity); onClose(); }} className="flex-1 h-12">Add to Cart</Button>
                    </div>
                </div>
            </div>
            {related.length > 0 && (
                <div className="p-6 border-t dark:border-gray-800">
                    <h3 className="font-bold text-xl mb-4">You Might Also Like</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {related.map(p => (
                            <div key={p.id} onClick={() => onSelectRelated(p)} className="cursor-pointer group">
                                <ImageWithLoader src={p.thumbnail} alt={p.title} className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800"/>
                                <h4 className="text-sm font-semibold mt-2 truncate group-hover:underline">{p.title}</h4>
                                <p className="text-sm font-bold">{formatPrice(p.price)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </Dialog>
  )
};

const CartSheet = ({ isOpen, onClose, cart, changeQty, removeFromCart, checkout, formatPrice }: { isOpen: boolean; onClose: () => void; cart: CartItem[]; changeQty: (id: number, qty: number) => void; removeFromCart: (id: number) => void; checkout: () => void; formatPrice: (p: number) => string; }) => (
    <Sheet isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800"><h3 className="text-xl font-bold dark:text-white">Shopping Cart</h3><Button variant="ghost" className="h-auto p-2 rounded-full" onClick={onClose}><X size={20}/></Button></div>
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6"><ShoppingCart size={48} className="text-gray-300 dark:text-gray-600 mb-4"/><h4 className="font-semibold text-lg dark:text-white">Your cart is empty</h4><p className="text-gray-500 dark:text-gray-400">Looks like you haven't added anything yet.</p><Button onClick={onClose} variant="outline" className="mt-4">Start Shopping</Button></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map(it => (<div key={it.product_id} className="flex items-start gap-4"><ImageWithLoader src={it.image} alt={it.title} className="w-20 h-20 rounded-lg shrink-0"/><div className="flex-1"><h4 className="font-semibold dark:text-white">{it.title}</h4><p className="text-sm text-gray-500 dark:text-gray-400">{formatPrice(it.price)}</p><div className="flex items-center gap-2 mt-2"><input type="number" min="1" value={it.quantity} onChange={e => changeQty(it.product_id, Number(e.target.value || 1))} className="w-16 border dark:border-gray-700 bg-transparent rounded-md px-2 py-1 text-center"/><button onClick={() => removeFromCart(it.product_id)} className="text-sm text-red-500 hover:underline">Remove</button></div></div></div>))}
          </div>
        )}
        <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50"><div className="flex justify-between font-bold text-lg mb-4 dark:text-white"><span>Subtotal</span><span>{formatPrice(cart.reduce((s, i) => s + i.price * i.quantity, 0))}</span></div><Button onClick={checkout} disabled={cart.length === 0} className="w-full">Proceed to Checkout</Button></div>
    </Sheet>
);

const WishlistSheet = ({ isOpen, onClose, wishlist, onAddToCart, onRemoveFromWishlist, formatPrice }: { isOpen: boolean; onClose: () => void; wishlist: Product[]; onAddToCart: (product: Product) => void; onRemoveFromWishlist: (product: Product) => void; formatPrice: (p: number) => string; }) => (
    <Sheet isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800"><h3 className="text-xl font-bold dark:text-white">Your Wishlist</h3><Button variant="ghost" className="h-auto p-2 rounded-full" onClick={onClose}><X size={20}/></Button></div>
        {wishlist.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6"><Heart size={48} className="text-gray-300 dark:text-gray-600 mb-4"/><h4 className="font-semibold text-lg dark:text-white">Your wishlist is empty</h4><p className="text-gray-500 dark:text-gray-400">Add your favorite items to see them here.</p><Button onClick={onClose} variant="outline" className="mt-4">Discover Products</Button></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {wishlist.map(product => (<div key={product.id} className="flex items-start gap-4"><ImageWithLoader src={product.thumbnail} alt={product.title} className="w-20 h-20 rounded-lg shrink-0"/><div className="flex-1"><h4 className="font-semibold dark:text-white">{product.title}</h4><p className="text-sm text-gray-500 dark:text-gray-400">{formatPrice(product.price)}</p><div className="flex items-center gap-4 mt-2"><button onClick={() => { onAddToCart(product); onRemoveFromWishlist(product); }} className="text-sm text-blue-500 hover:underline">Move to Cart</button><button onClick={() => onRemoveFromWishlist(product)} className="text-sm text-red-500 hover:underline">Remove</button></div></div></div>))}
          </div>
        )}
    </Sheet>
);

const AuthDialog = ({ onClose, handleAuth }: { onClose: () => void; handleAuth: (m: 'login' | 'register', e: string, u: string, p: string) => Promise<void> }) => {
    const [mode, setMode] = useState<'login' | 'register'>("login");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const submit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); await handleAuth(mode, email, username, password); setLoading(false); }

    return (
        <Dialog isOpen={true} onClose={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-md relative shadow-lg">
                <Button variant="ghost" className="absolute top-4 right-4 h-auto p-2 rounded-full" onClick={onClose}><X size={20}/></Button>
                <h2 className="text-2xl font-bold mb-2 text-center dark:text-white">{mode === 'login' ? 'Welcome Back!' : 'Create an Account'}</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">{mode === 'login' ? 'Login to continue shopping' : 'Sign up to get started'}</p>
                <form onSubmit={submit} className="space-y-4">
                    {mode === 'register' && <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full border dark:border-gray-700 bg-transparent rounded-lg px-4 py-2" required />}
                    <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full border dark:border-gray-700 bg-transparent rounded-lg px-4 py-2" required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border dark:border-gray-700 bg-transparent rounded-lg px-4 py-2" required />
                    <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Login' : 'Register')}</Button>
                </form>
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">{mode === 'login' ? "Don't have an account? " : "Already have an account? "}<button className="font-semibold text-gray-900 dark:text-white hover:underline" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Register' : 'Login'}</button></div>
            </div>
        </Dialog>
    );
};

const ProfileSheet = ({ isOpen, onClose, user, onLogoutClick, onWishlistClick }: { isOpen: boolean; onClose: () => void; user: string | null; onLogoutClick: () => void; onWishlistClick: () => void; }) => {
  const listVariants = {
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
    hidden: {},
  };
  const itemVariants = {
    visible: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
    hidden: { y: 20, opacity: 0, transition: { y: { stiffness: 1000 } } },
  };
  const menuItems = [
    { icon: User, label: "Personal Information" },
    { icon: Package, label: "My Orders" },
    { icon: Heart, label: "My Wishlist", action: onWishlistClick },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
            <h3 className="text-xl font-bold dark:text-white">My Profile</h3>
            <Button variant="ghost" className="h-auto p-2 rounded-full" onClick={onClose}><X size={20}/></Button>
        </div>
        <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center gap-4 pb-6 border-b dark:border-gray-800">
                <div className="w-16 h-16 flex items-center justify-center bg-gray-900 dark:bg-gray-50 text-white dark:text-gray-900 font-bold rounded-full text-3xl">
                    {user?.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 className="text-lg font-bold dark:text-white">{user}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back!</p>
                </div>
            </div>
            <motion.ul variants={listVariants} initial="hidden" animate="visible" className="mt-6 space-y-2">
                {menuItems.map(item => (
                    <motion.li key={item.label} variants={itemVariants}>
                        <button onClick={item.action} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors text-left">
                            <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{item.label}</span>
                        </button>
                    </motion.li>
                ))}
            </motion.ul>
            <div className="mt-auto">
                <Button onClick={onLogoutClick} variant="outline" className="w-full flex items-center gap-2">
                    <LogOut size={16} /> Logout
                </Button>
            </div>
        </div>
    </Sheet>
  );
};

// ======================================================================
// --- 5. MAIN APP COMPONENT ---
// ======================================================================

export default function App() {
  const [theme, setTheme] = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sort, setSort] = useState("id");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<string | null>(localStorage.getItem("user"));
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const isLoggedIn = !!localStorage.getItem("accessToken");

  const formatPrice = useCallback((p?: number) => `₹${(p || 0).toFixed(2)}`, []);

  // --- DATA FETCHING & LOGIC ---
  const fetchCart = useCallback(async () => {
    if (!isLoggedIn) { setCart([]); return; }
    try {
      const res = await api.get('/cart');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const productDetails = await Promise.all(
        data.items.map(async (item: any) => {
          try {
            const productRes = await fetch(`${API_BASE}/products/${item.product_id}`);
            if(!productRes.ok) return null;
            const productData = await productRes.json();
            return { ...item, title: productData.title, price: productData.price, image: productData.thumbnail };
          } catch { return null; }
        })
      );
      setCart(productDetails.filter(Boolean));
    } catch (e) { toast.error("Could not sync your cart."); }
  }, [isLoggedIn]);

  const fetchWishlist = useCallback(async () => {
    if (!isLoggedIn) { setWishlist([]); return; }
    try {
      const res = await api.get('/wishlist');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWishlist(data.items || []);
    } catch (e) { toast.error("Could not sync your wishlist."); }
  }, [isLoggedIn]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (debouncedSearch) {
        url = `${API_BASE}/products/search?search_str=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=12`;
      } else {
        const q = new URLSearchParams({ page: String(page), limit: String(12), sort });
        if (selectedCategory) q.set("category", selectedCategory);
        url = `${API_BASE}/products?${q.toString()}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data.products || []);
      setPages(data.pages || 1);
    } catch (e) {
      toast.error("Could not load products.");
    } finally { setLoading(false); }
  }, [page, selectedCategory, sort, debouncedSearch]);

  // --- HANDLERS ---
  const addToCart = async (product: Product, quantity = 1) => {
    if (product.stock <= 0) { toast.error("Out of stock"); return; }
    if (!isLoggedIn) { setAuthModalOpen(true); return; }
    try {
      const res = await api.post('/cart/add', { product_id: product.id, quantity });
      if(!res.ok) throw new Error((await res.json()).detail || "Failed to add item");
      await fetchCart();
      toast.success(`${product.title} added to cart!`);
      setCartOpen(true);
    } catch (error: any) { toast.error(error.message); }
  };

  const changeQty = async (product_id: number, qty: number) => {
    if (qty < 1) return;
    try {
      const res = await api.post('/cart/update_quantity', { product_id, quantity: qty });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update quantity");
      await fetchCart();
    } catch (error: any) { toast.error(error.message); }
  };

  const removeFromCart = async (product_id: number) => {
    try {
      const res = await api.post('/cart/remove', { product_id });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to remove item");
      await fetchCart();
      toast.info("Item removed from cart.");
    } catch (error: any) { toast.error(error.message); }
  };

  const checkout = async () => {
    if (!cart.length) { toast.warning("Cart is empty"); return; }
    try {
      const res = await api.post('/cart/checkout', {});
      if (!res.ok) throw new Error((await res.json()).detail || "Checkout failed");
      const body = await res.json();
      if (body.url) { window.location.href = body.url; }
      else { toast.success(`Order placed! Total: ${formatPrice(body.total)}`); fetchCart(); setCartOpen(false); }
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleWishlist = async (product: Product) => {
    if(!isLoggedIn) { setAuthModalOpen(true); return; }
    const isInWishlist = wishlist.some(item => item.id === product.id);
    try {
      const res = await api.post(isInWishlist ? '/wishlist/remove' : '/wishlist/add', { product_id: product.id });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update wishlist");
      await fetchWishlist();
      toast.success(isInWishlist ? "Removed from wishlist" : "Added to wishlist!");
    } catch(error: any) { toast.error(error.message); }
  };

  const handleAuth = async (mode: 'login' | 'register', email: string, username: string, password: string) => {
    try {
      const url = `${API_BASE}/users/${mode}`;
      const body = mode === "login" ? { email, password } : { email, username, password };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).detail || "Authentication failed");
      const data = await res.json();
      if (mode === "login") {
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("refreshToken", data.refresh_token);
        localStorage.setItem("user", data.username || email);
        window.dispatchEvent(new Event("authChange"));
        toast.success("Login successful!");
        setAuthModalOpen(false);
      } else {
        toast.info("Registered successfully! Please login.");
      }
    } catch (e: any) { toast.error(e.message); }
  };
  
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(cat => cat === category ? "" : category);
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); }
    else { try { recognitionRef.current.start(); } catch {} }
  };

  // --- EFFECTS ---
  useEffect(() => {
    const handleAuthChange = () => { setUser(localStorage.getItem("user")); fetchCart(); fetchWishlist(); };
    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, [fetchCart, fetchWishlist]);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        setCategories((await res.json()).categories || []);
      } catch (e) { console.warn(e); }
      await fetchCart();
      await fetchWishlist();
    };
    fetchInitialData();
  }, [fetchCart, fetchWishlist]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedCategory, sort]);
  
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => console.error(e.error);
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0]?.transcript ?? "").join(" ").trim();
      if (text) setSearch(text);
    };
    recognitionRef.current = rec;
    setMicSupported(true);
    return () => { try { rec.abort(); } catch {} };
  }, []);

  // --- RENDER ---
  return (
    <>
      {/* --- MODIFIED: Added custom text-shadow utility --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); 
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .text-shadow { text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2); }
      `}</style>
      <Toaster position="bottom-right" richColors />
      <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans transition-colors duration-300">
        <Header 
            user={user} 
            onLoginClick={() => setAuthModalOpen(true)} 
            onLogoutClick={api.logout} 
            onCartClick={() => setCartOpen(true)} 
            onWishlistClick={() => setWishlistOpen(true)} 
            onProfileClick={() => setProfileOpen(true)}
            cartItemCount={cart.length} 
            wishlistItemCount={wishlist.length}
            theme={theme} 
            setTheme={setTheme} 
        />
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Slider />
          <CategoryCarousel categories={categories} onCategorySelect={handleCategorySelect} selectedCategory={selectedCategory} />
          <div id="products-section" className="py-12 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 dark:text-white">Our Products</h2>
            <ProductFilters search={search} setSearch={setSearch} toggleMic={toggleMic} listening={listening} micSupported={micSupported} sort={sort} setSort={setSort} />
            
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8"
            >
              <AnimatePresence>
                {loading ? (
                    Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
                ) : products.length === 0 ? (
                  <motion.div initial={{ opacity: 0}} animate={{ opacity: 1}} className="col-span-full text-center py-16 bg-white dark:bg-gray-900 rounded-lg mt-8 border dark:border-gray-800"><h3 className="text-xl font-semibold">No Products Found</h3><p className="text-gray-500 mt-2">Try adjusting your search or filters.</p></motion.div>
                ) : (
                    products.map(p => (
                        <motion.div layout key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <ProductCard product={p} onViewClick={() => setSelectedProduct(p)} onAddClick={() => addToCart(p)} onWishlistClick={() => toggleWishlist(p)} isInWishlist={wishlist.some(item => item.id === p.id)} formatPrice={formatPrice} />
                        </motion.div>
                    ))
                )}
              </AnimatePresence>
            </motion.div>

            {pages > 1 && <Pagination page={page} pages={pages} onPageChange={setPage} />}
          </div>
          <BrandLogos/>
        </main>
        <Footer />

        {selectedProduct && <ProductDetailDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} formatPrice={formatPrice} onSelectRelated={setSelectedProduct} />}
        {authModalOpen && <AuthDialog onClose={() => setAuthModalOpen(false)} handleAuth={handleAuth} />}
        <CartSheet isOpen={cartOpen} onClose={() => setCartOpen(false)} cart={cart} changeQty={changeQty} removeFromCart={removeFromCart} checkout={checkout} formatPrice={formatPrice} />
        <WishlistSheet isOpen={wishlistOpen} onClose={() => setWishlistOpen(false)} wishlist={wishlist} onAddToCart={addToCart} onRemoveFromWishlist={toggleWishlist} formatPrice={formatPrice} />
        <ProfileSheet 
            isOpen={profileOpen} 
            onClose={() => setProfileOpen(false)} 
            user={user} 
            onLogoutClick={api.logout} 
            onWishlistClick={() => { setProfileOpen(false); setWishlistOpen(true); }}
        />
      </div>
    </>
  );
}