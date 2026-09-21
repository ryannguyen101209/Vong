import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { Home } from './pages/Home.jsx';
import { Browse } from './pages/Browse.jsx';
import { ListingDetail } from './pages/ListingDetail.jsx';
import { Sell } from './pages/Sell.jsx';
import { Payment } from './pages/Payment.jsx';
import { Saved } from './pages/Saved.jsx';
import { About } from './pages/About.jsx';
import { Faq } from './pages/Faq.jsx';
import { Contact } from './pages/Contact.jsx';
import { Admin } from './pages/Admin.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { Messages } from './pages/Messages.jsx';
import { SignInDialog } from './components/SignInDialog.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // In the embedded demo the app shell scrolls, not the window.
    document.getElementById('root')?.scrollTo?.(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/payment/:id" element={<Payment />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SignInDialog />
      <Footer />
    </>
  );
}
