/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

HTMLDialogElement.prototype.showModal = jest.fn()
HTMLDialogElement.prototype.close = jest.fn()

describe('Modal', () => {
  const onClose = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onClose} title="Test">
        <p>content</p>
      </Modal>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen title="My Modal" onClose={onClose}>
        <p>modal body</p>
      </Modal>
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('modal body')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal isOpen title="Test" onClose={onClose}>
        <p>content</p>
      </Modal>
    )
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <Modal isOpen title="Test" onClose={onClose}>
        <p>content</p>
      </Modal>
    )
    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key when open', () => {
    render(
      <Modal isOpen title="Test" onClose={onClose}>
        <p>content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not add keydown listener when closed', () => {
    render(
      <Modal isOpen={false} title="Test" onClose={onClose}>
        <p>content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
