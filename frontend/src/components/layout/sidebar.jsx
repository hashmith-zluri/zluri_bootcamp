import { NavLink, useNavigate } from "react-router-dom";

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;

  const isManager = role === "MANAGER" || role === "ADMIN";
  const isDeveloper = role === "DEVELOPER";

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">DB Portal</h2>
      </div>
      
      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-gray-700">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-gray-400">{role}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {(isDeveloper || isManager) && (
          <>
            <NavLink 
              to="/submit" 
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-800 text-gray-300'
                }`
              }
            >
              <span>Submit Request</span>
            </NavLink>
            
            <NavLink 
              to="/my-submissions" 
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-800 text-gray-300'
                }`
              }
            >
              <span>My Submissions</span>
            </NavLink>
          </>
        )}

        {isManager && (
          <>
            <div className="pt-2 pb-1">
              <div className="h-px bg-gray-700"></div>
            </div>
            <NavLink 
              to="/approvals" 
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-purple-600 text-white' 
                    : 'hover:bg-gray-800 text-gray-300'
                }`
              }
            >
              <span>Approval Dashboard</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
