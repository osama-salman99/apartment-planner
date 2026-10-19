import { useLayoutStore } from '../state/layoutStore';

function toCsv(items: ReturnType<typeof useLayoutStore.getState>['items']): string {
  const header = 'Name,Width cm,Depth cm,Height cm,Color\n';
  const rows = items.map((i) => `${i.name},${Math.round(i.w)},${Math.round(i.d)},${Math.round(i.h)},${i.colorHex}`);
  return header + rows.join('\n');
}

export function ShoppingListPanel() {
  const items = useLayoutStore((s) => s.items);
  const select = useLayoutStore((s) => s.select);

  const download = () => {
    const blob = new Blob([toCsv(items)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (items.length === 0) {
    return <div className="empty-state">Nothing placed yet. Everything you add shows up here with its dimensions, ready to take shopping.</div>;
  }

  return (
    <div className="panel-section" style={{ borderBottom: 'none' }}>
      <table className="shopping-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>W×D×H cm</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} onClick={() => select(i.id)}>
              <td>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i.colorHex,
                    marginRight: 6,
                  }}
                />
                {i.name}
              </td>
              <td>
                {Math.round(i.w)}×{Math.round(i.d)}×{Math.round(i.h)}
              </td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={download}>
        Export CSV
      </button>
    </div>
  );
}
