import React from 'react';

const Sidebar = () => {
  return (
    <div className="fixed top-0 left-0 h-full w-64 bg-black bg-opacity-90 neon-border p-4 z-50 transform -translate-x-full transition-transform duration-300">
      <h2 className="text-xl dragon-font mb-4 glitch-text">VOID KERNEL CONFIG</h2>
      {/* Add sidebar content here */}
      <p className="ui-font text-sm">Configuration options will go here.</p>
    </div>
  );
};

export default Sidebar;
