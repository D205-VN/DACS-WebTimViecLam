import Header from '@components/layouts/Header';
import Footer from '@components/layouts/Footer';

export default function MainLayout({ children }) {
  return (
    <div className="aw-page flex flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
