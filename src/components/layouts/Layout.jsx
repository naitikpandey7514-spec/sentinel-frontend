import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <TopBar />
        <section className="content-area">
          {children}
        </section>
      </main>
    </div>
  );
}

export default Layout;