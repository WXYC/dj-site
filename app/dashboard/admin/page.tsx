import AdminGuard from "@/app/components/Admin/AdminGuard";

const AdminPage = () => {
    return (
        <div>
        <AdminGuard />
        <h1>Admin Page</h1>
        </div>
    );
};

export default AdminPage;