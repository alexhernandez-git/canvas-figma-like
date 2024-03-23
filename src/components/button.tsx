import React from "react";

const Button = ({ onClick, children, disabled = false }) => {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
      className="rounded block w-full bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
