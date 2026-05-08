import Header from '@widgets/layout/Header';
import Footer from '@widgets/layout/Footer';

export default function MainLayout({ children }) {
  return (
    <div className="aw-page flex flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
