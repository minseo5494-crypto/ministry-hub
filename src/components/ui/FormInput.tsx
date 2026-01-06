'use client'

import { LucideIcon } from 'lucide-react'
import { InputHTMLAttributes, forwardRef } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: LucideIcon
  error?: string
  helperText?: string
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, icon: Icon, error, helperText, className = '', ...props }, ref) => {
    const hasIcon = !!Icon

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
          )}
          <input
            ref={ref}
            className={`
              w-full py-3 border rounded-lg transition
              focus:ring-2 focus:border-transparent text-base
              ${hasIcon ? 'pl-10 pr-4' : 'px-4'}
              ${error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
              }
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

FormInput.displayName = 'FormInput'

export default FormInput
