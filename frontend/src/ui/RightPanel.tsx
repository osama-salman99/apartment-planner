import { useState } from 'react';
import { ItemInspector } from './ItemInspector';
import { ShoppingListPanel } from './ShoppingListPanel';
import { LightPanel } from './LightPanel';

type Tab = 'item' | 'list' | 'light';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('item');

  return (
    <div className="panel panel-inspector">
      <div className="tabs">
        <button className={tab === 'item' ? 'active' : ''} onClick={() => setTab('item')}>
          Item
        </button>
        <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          Shopping list
        </button>
        <button className={tab === 'light' ? 'active' : ''} onClick={() => setTab('light')}>
          Light
        </button>
      </div>
      {tab === 'item' && <ItemInspector />}
      {tab === 'list' && <ShoppingListPanel />}
      {tab === 'light' && <LightPanel />}
    </div>
  );
}
