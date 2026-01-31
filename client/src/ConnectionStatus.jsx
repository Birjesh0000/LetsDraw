/**
 * ConnectionStatus Component
 * Displays connection status and online users
 */

function ConnectionStatus({ isConnected, users = [], currentUserId }) {
  const statusText = isConnected ? 'Connected' : 'Disconnected';
  const userCount = users.length;

  return (
    <div className="bg-secondary text-white px-6 py-3 border-b border-primary flex flex-wrap items-center gap-6">
      {/* Status Indicator */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black bg-opacity-20 rounded border border-opacity-10 border-white">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected
              ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/60'
              : 'bg-red-500'
          }`}
        ></div>
        <span className="font-semibold text-gray-200">{statusText}</span>
      </div>

      {/* User Count */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500 bg-opacity-20 rounded border border-blue-400">
        <span className="text-gray-100">
          👥 {userCount} User{userCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Users List Dropdown */}
      {users.length > 0 && (
        <div className="relative group">
          <button className="px-3 py-2 bg-blue-500 bg-opacity-30 rounded border border-blue-400 hover:bg-opacity-50 transition-all text-white font-medium">
            📋
          </button>
          <div className="absolute top-full right-0 mt-2 bg-primary border border-secondary rounded shadow-2xl min-w-max opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-4 py-2 border-b border-secondary font-semibold text-gray-200 text-sm">
              Active Users ({userCount})
            </div>
            <div className="max-h-64 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="px-4 py-2 border-b border-secondary last:border-b-0 hover:bg-secondary transition-colors flex items-center gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                    title={user.color}
                  ></div>
                  <span className="text-gray-200 text-sm">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="text-blue-400 font-semibold ml-1">
                        (You)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
