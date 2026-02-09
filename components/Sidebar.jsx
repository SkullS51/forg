
import React from 'react';
// Removed specific type imports from '../types' as they are now used implicitly for runtime.
// If type checking is desired during development, a separate TypeScript setup would be required.

const Sidebar = ({ history, onSelect, currentId, kernelConfig, setKernelConfig }) => {
  return React.createElement(
    "aside",
    { className: "w-full h-full bg-[#050000] flex flex-col text-red-600" },
    React.createElement(
      "div",
      { className: "p-4 border-b border-red-950 bg-[#0a0000] flex justify-between items-center" },
      React.createElement(
        "h2",
        { className: "text-xs font-black uppercase tracking-[0.2em] text-red-700" },
        "Kernel Config"
      )
    ),
    React.createElement(
      "div",
      { className: "p-4 space-y-4 border-b border-red-950" },
      React.createElement(
        "div",
        { className: "space-y-1" },
        React.createElement(
          "label",
          { className: "text-[9px] uppercase font-black text-red-900" },
          "Groq reasoning key"
        ),
        React.createElement("input", {
          type: "password",
          value: kernelConfig.groqKey,
          onChange: e => setKernelConfig(prev => ({ ...prev, groqKey: e.target.value })),
          className: "w-full bg-black border border-red-900 text-[10px] p-2 text-red-500 focus:border-white outline-none",
          placeholder: "gsk_..."
        })
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement("input", {
          type: "checkbox",
          id: "useGroq",
          checked: kernelConfig.useGroqForAudio,
          onChange: e => setKernelConfig(prev => ({ ...prev, useGroqForAudio: e.target.checked })),
          className: "accent-red-600"
        }),
        React.createElement(
          "label",
          { htmlFor: "useGroq", className: "text-[10px] uppercase font-black cursor-pointer" },
          "Use 405B Reasoning"
        )
      )
    ),
    React.createElement(
      "div",
      { className: "p-4 bg-[#0a0000] border-b border-red-950" },
      React.createElement(
        "h2",
        { className: "text-[10px] font-black uppercase tracking-widest" },
        "Archive"
      )
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar" },
      history.length === 0
        ? React.createElement(
            "div",
            { className: "p-12 text-center text-[10px] text-red-950 uppercase italic tracking-widest font-black" },
            "Ledger Empty"
          )
        : history.map(item =>
            React.createElement(
              "button",
              {
                key: item.id,
                onClick: () => onSelect(item),
                className: `w-full p-4 border-b border-[#150000] text-left hover:bg-[#100000] transition-all group ${currentId === item.data.prompt ? 'bg-[#1a0000] border-l-4 border-l-red-600' : ''}`
              },
              React.createElement(
                "div",
                { className: "flex gap-4 items-center" },
                React.createElement("img", {
                  src: item.data.imageUrl,
                  className: "w-12 h-12 border border-red-900 grayscale group-hover:grayscale-0 transition-all object-cover",
                  alt: "p"
                }),
                React.createElement(
                  "div",
                  { className: "flex-1 min-w-0" },
                  React.createElement(
                    "div",
                    { className: "text-[8px] text-red-900 mb-1 font-mono" },
                    new Date(item.timestamp).toLocaleTimeString()
                  ),
                  React.createElement(
                    "div",
                    { className: "text-[10px] font-black truncate text-red-700 group-hover:text-red-500 uppercase tracking-tight" },
                    item.data.prompt
                  )
                )
              )
            )
          )
    ),
    React.createElement(
      "div",
      { className: "p-4 bg-[#0a0000] border-t border-red-900" },
      React.createElement(
        "div",
        { className: "text-[8px] text-red-900 uppercase font-black leading-tight italic opacity-50" },
        "S-1792 Core Active",
        React.createElement("br", null),
        "Weaponized Reasoning Profile"
      )
    )
  );
};

export default Sidebar;