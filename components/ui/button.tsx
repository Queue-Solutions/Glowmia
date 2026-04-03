import * as React from "react"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'outline'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'
  
  const variantStyles = variant === 'outline'
    ? 'border bg-white text-slate-950'
    : 'bg-slate-900 text-white shadow hover:bg-slate-800'
  
  return (
    <button
      ref={ref}
      className={`${baseStyles} ${className ? '' : variantStyles} ${className || ''}`}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
