// src/pages/Suppliers.jsx
import React, { useState } from 'react';
import Button from '../components/button';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([
    { id: 1, name: 'Supplier X', city: 'Karachi', phone: '0300-1111111' },
    { id: 2, name: 'Supplier Y', city: 'Lahore', phone: '0321-2222222' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
      <Button className="mb-4">Add Supplier</Button>

      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>City</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.city}</td>
              <td>{s.phone}</td>
              <td>
                <Button>Edit</Button> <Button>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
