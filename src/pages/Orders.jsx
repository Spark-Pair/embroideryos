// src/pages/Orders.jsx
import React, { useState } from 'react';
import Button from '../components/button';

export default function Orders() {
  const [orders, setOrders] = useState([
    { id: 1, customer: 'Customer A', date: '2025-12-10', status: 'Pending' },
    { id: 2, customer: 'Customer B', date: '2025-12-11', status: 'Completed' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      <Button className="mb-4">Add Order</Button>

      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.customer}</td>
              <td>{o.date}</td>
              <td>{o.status}</td>
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
