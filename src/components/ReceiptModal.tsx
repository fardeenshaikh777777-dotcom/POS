import { formatPKR } from '@/lib/format'
import type { Order } from '@/types/domain'
import { Button } from './ui'

interface ReceiptModalProps {
  order: Order
  onClose: () => void
}

export function ReceiptModal({ order, onClose }: ReceiptModalProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content receipt-card">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <Button variant="accent" onClick={handlePrint}>🖨️ Print Receipt (80mm)</Button>
          <Button variant="ghost" onClick={onClose}>✕ Close</Button>
        </div>

        <div className="thermal-receipt" id="printable-receipt">
          <div className="receipt-header">
            <h2 className="receipt-title">KARACHI EXPRESS</h2>
            <p className="receipt-sub">Authentic Karachi Cuisine</p>
            <p className="receipt-meta">Plot 12-C, Block 4, Clifton, Karachi</p>
            <p className="receipt-meta">Tel: 021-35876543 | SST Reg: 3274910-1</p>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-row">
            <span><strong>Order #{order.order_number}</strong></span>
            <span className="badge badge--ok">{order.type.toUpperCase()}</span>
          </div>
          <div className="receipt-row">
            <span>Date: {new Date(order.created_at).toLocaleDateString('en-GB')}</span>
            <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {order.table && (
            <div className="receipt-row">
              <span><strong>Table: {order.table.label}</strong></span>
              <span>Guests: {order.table.seats}</span>
            </div>
          )}
          {order.customer_name && (
            <div className="receipt-row">
              <span>Customer: {order.customer_name}</span>
              <span>{order.customer_phone}</span>
            </div>
          )}
          {order.delivery_address && (
            <div className="receipt-meta" style={{ marginTop: '4px' }}>
              Delivery: {order.delivery_address}
            </div>
          )}

          <div className="receipt-divider" />

          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((it) => (
                <tr key={it.id}>
                  <td style={{ textAlign: 'left' }}>
                    {it.item_name}
                    {it.notes && <small style={{ display: 'block', color: '#666' }}>({it.notes})</small>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPKR(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-divider" />

          <div className="receipt-row">
            <span>Subtotal:</span>
            <span>{formatPKR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="receipt-row" style={{ color: 'var(--danger)' }}>
              <span>Discount:</span>
              <span>-{formatPKR(order.discount)}</span>
            </div>
          )}
          {order.tax > 0 && (
            <div className="receipt-row">
              <span>Sindh Sales Tax (13%):</span>
              <span>{formatPKR(order.tax)}</span>
            </div>
          )}
          {order.delivery_fee > 0 && (
            <div className="receipt-row">
              <span>Delivery Charges:</span>
              <span>{formatPKR(order.delivery_fee)}</span>
            </div>
          )}

          <div className="receipt-divider" />

          <div className="receipt-row receipt-total">
            <span><strong>NET TOTAL:</strong></span>
            <span><strong>{formatPKR(order.total)}</strong></span>
          </div>

          {order.payments && order.payments.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div className="receipt-divider" />
              {order.payments.map((p) => (
                <div key={p.id} className="receipt-row" style={{ fontSize: '11px' }}>
                  <span>Paid via {p.method.toUpperCase()}</span>
                  <span>{formatPKR(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="receipt-divider" />

          <div className="receipt-footer">
            <p>*** THANK YOU FOR YOUR VISIT ***</p>
            <p>Feedback / Home Delivery: 0300-1234567</p>
            <p style={{ fontSize: '9px', marginTop: '4px' }}>Software: Karachi Express POS v2.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
