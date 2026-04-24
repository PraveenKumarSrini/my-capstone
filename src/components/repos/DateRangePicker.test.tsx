/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DateRangePicker from './DateRangePicker'

describe('DateRangePicker', () => {
  const onChange = jest.fn()
  const from = '2026-01-01'
  const to = '2026-01-31'

  beforeEach(() => jest.clearAllMocks())

  it('renders From and To labels', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('sets input values from props', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    expect((inputs[0] as HTMLInputElement).value).toBe(from)
    expect((inputs[1] as HTMLInputElement).value).toBe(to)
  })

  it('calls onChange when from date is updated to a valid value', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(inputs[0], { target: { value: '2026-01-05' } })
    expect(onChange).toHaveBeenCalledWith('2026-01-05', to)
  })

  it('does not call onChange when from is later than to', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(inputs[0], { target: { value: '2026-02-01' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange when to date is updated to a valid value', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(inputs[1], { target: { value: '2026-02-15' } })
    expect(onChange).toHaveBeenCalledWith(from, '2026-02-15')
  })

  it('does not call onChange when to is earlier than from', () => {
    render(<DateRangePicker from={from} to={to} onChange={onChange} />)
    const inputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(inputs[1], { target: { value: '2025-12-01' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
