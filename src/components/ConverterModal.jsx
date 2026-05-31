import { useState } from 'react'
import { cToF, fToC } from '../lib/units.js'

const fmt = (n) => String(Math.round(n * 100) / 100)

export default function ConverterModal({ onClose }) {
  const [c, setC] = useState('')
  const [f, setF] = useState('')

  const onChangeC = (v) => {
    setC(v)
    setF(v === '' || Number.isNaN(Number(v)) ? '' : fmt(cToF(Number(v))))
  }
  const onChangeF = (v) => {
    setF(v)
    setC(v === '' || Number.isNaN(Number(v)) ? '' : fmt(fToC(Number(v))))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Temperature converter" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Temperature converter</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close converter">×</button>
        </div>
        <label className="conv-row">
          <span>°C</span>
          <input
            type="number"
            inputMode="decimal"
            value={c}
            onChange={(e) => onChangeC(e.target.value)}
            aria-label="Celsius"
            placeholder="e.g. 21"
          />
        </label>
        <div className="conv-eq">⇅</div>
        <label className="conv-row">
          <span>°F</span>
          <input
            type="number"
            inputMode="decimal"
            value={f}
            onChange={(e) => onChangeF(e.target.value)}
            aria-label="Fahrenheit"
            placeholder="e.g. 70"
          />
        </label>
      </div>
    </div>
  )
}
