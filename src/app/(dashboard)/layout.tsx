import Sidebar from "@/components/Sidebar/Sidebar";
import Navbar from "@/components/Navbar/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ 
        flex: 1, 
        marginLeft: "var(--sidebar-width)", 
        display: "flex", 
        flexDirection: "column",
        minWidth: 0
      }}>
        <Navbar />
        <main style={{ 
          marginTop: "var(--navbar-height)", 
          padding: "2rem",
          flex: 1,
          overflowY: "auto"
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
