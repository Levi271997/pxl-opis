'use client';

import { useState } from 'react';
import { FOODS } from '@/lib/data';
import { useOffice } from '@/lib/store';
import FoodIcon from './FoodIcon';

export default function FridgePanel() {
  const fridge = useOffice(s => s.fridge);
  const bag = useOffice(s => s.bag);
  const { takeFood, putBackFood } = useOffice.getState();
  const [note, setNote] = useState('Cold air rolls out. What do you want to grab?');
  const packed = FOODS.filter(f => bag[f.id] > 0);

  return (
    <div className="fridge">
      <p className="fridge-note">{note}</p>

      <div className="fridge-shelves">
        {FOODS.map(f => {
          const left = fridge[f.id];
          return (
            <article key={f.id} className={`food${left === 0 ? ' empty' : ''}`}>
              <FoodIcon id={f.id} />
              <div className="food-info">
                <strong>{f.name}</strong>
                <span>{f.note}</span>
              </div>
              <span className="food-qty">x{left}</span>
              <button
                className="mini-btn"
                disabled={left === 0}
                onClick={() => {
                  if (f.locked) return setNote(f.locked);
                  takeFood(f.id);
                  setNote(`You grab the ${f.name.toLowerCase()}.`);
                }}
              >
                {left === 0 ? 'Gone' : 'Take'}
              </button>
            </article>
          );
        })}
      </div>

      <h4 className="section-label">Your lunch bag</h4>
      {packed.length ? (
        <ul className="bag">
          {packed.map(f => (
            <li key={f.id}>
              <FoodIcon id={f.id} className="food-icon small" />
              <span>{f.name} x{bag[f.id]}</span>
              <button
                className="mini-btn"
                onClick={() => { putBackFood(f.id); setNote(`You put the ${f.name.toLowerCase()} back.`); }}
              >
                Put back
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Empty. Take something from the shelves above.</p>
      )}
      <p className="fridge-tip">Hungry? Take it to a table in the Dining Room and press E to eat.</p>
    </div>
  );
}
