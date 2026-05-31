import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConverterModal from './ConverterModal.jsx'

describe('ConverterModal', () => {
  it('converts Celsius to Fahrenheit as you type', () => {
    render(<ConverterModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Celsius'), { target: { value: '100' } })
    expect(screen.getByLabelText('Fahrenheit')).toHaveValue(212)
  })

  it('converts Fahrenheit to Celsius as you type', () => {
    render(<ConverterModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Fahrenheit'), { target: { value: '32' } })
    expect(screen.getByLabelText('Celsius')).toHaveValue(0)
  })

  it('clears the other field when input is emptied', () => {
    render(<ConverterModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Celsius'), { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText('Celsius'), { target: { value: '' } })
    expect(screen.getByLabelText('Fahrenheit')).toHaveValue(null)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<ConverterModal onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close converter'))
    expect(onClose).toHaveBeenCalled()
  })
})
