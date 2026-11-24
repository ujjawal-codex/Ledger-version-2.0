
import React, { useEffect, useMemo, useState } from "react";
import Auth from "./auth.jsx";
import { supabase } from "./supabase";

const money = n =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(n || 0));

const blankCustomer = {
  name: "",
  mobile: "",
  address: ""
};

function Workspace({ user, profile, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);

  const [customerForm, setCustomerForm] = useState(blankCustomer);
  const [productForm, setProductForm] = useState({
    name: "",
    default_rate: "",
    default_unit: "kg"
  });

  const [billForm, setBillForm] = useState({
    customer_id: "",
    bill_date: new Date().toISOString().slice(0, 10),
    items: [{ product_id: "", quantity: "", unit: "kg", rate: "" }]
  });

  const [paymentForm, setPaymentForm] = useState({
    customer_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    amount: "",
    mode: "Cash",
    note: ""
  });

  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [ledgerCustomerId, setLedgerCustomerId] = useState("");
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [showInlineCustomer, setShowInlineCustomer] = useState(false);
  const [inlineCustomerForm, setInlineCustomerForm] = useState(blankCustomer);
  const [inlineCustomerSaving, setInlineCustomerSaving] = useState(false);
  const [inlineProductRow, setInlineProductRow] = useState(null);
  const [inlineProductForm, setInlineProductForm] = useState({ name: "", default_rate: "", default_unit: "kg" });
  const [inlineProductSaving, setInlineProductSaving] = useState(false);

  async function loadAdminUsers() {
    if (!supabase || profile.role !== "super_admin") return;

    setAdminLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice("Could not load users: " + error.message);
    } else {
      setAdminUsers(data || []);
      setPendingRoles({});
    }
    setAdminLoading(false);
  }

  async function saveUserRole(targetUser) {
    const nextRole = pendingRoles[targetUser.id];
    if (!nextRole || !["admin", "user"].includes(nextRole)) return;
    if (targetUser.role === "super_admin" || targetUser.id === user.id) {
      setNotice("The Super Admin account is protected.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${targetUser.full_name || "this user"} to ${nextRole}?`
    );
    if (!confirmed) return;

    setAdminLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", targetUser.id);

    if (error) {
      setNotice("Role update failed: " + error.message);
    } else {
      setNotice("User role updated.");
      await loadAdminUsers();
    }
    setAdminLoading(false);
  }

  async function loadAll() {
    if (!supabase) return;

    setLoading(true);

    const [c, p, b, pa] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*").order("name"),
      supabase
        .from("bills")
        .select("*, bill_items(*)")
        .order("bill_date", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false })
    ]);

    const error = c.error || p.error || b.error || pa.error;

    if (error) {
      setNotice(error.message);
    } else {
      setCustomers(c.data || []);
      setProducts(p.data || []);
      setBills(b.data || []);
      setPayments(pa.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "admin" && profile.role === "super_admin") {
      loadAdminUsers();
    }
  }, [tab, profile.role]);

  const customerStats = useMemo(
    () =>
      customers.map(customer => {
        const sales = bills
          .filter(b => b.customer_id === customer.id)
          .reduce((sum, bill) => sum + Number(bill.total_amount), 0);

        const paid = payments
          .filter(p => p.customer_id === customer.id)
          .reduce((sum, payment) => sum + Number(payment.amount), 0);

        return {
          ...customer,
          sales,
          paid,
          balance: sales - paid
        };
      }),
    [customers, bills, payments]
  );

  const totalSales = bills.reduce(
    (sum, bill) => sum + Number(bill.total_amount),
    0
  );

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  const ledgerCustomer = customers.find(c => c.id === ledgerCustomerId) || customers[0] || null;
  const ledgerBills = bills.filter(b =>
    ledgerCustomer && b.customer_id === ledgerCustomer.id &&
    (!ledgerFrom || b.bill_date >= ledgerFrom) &&
    (!ledgerTo || b.bill_date <= ledgerTo)
  );
  const ledgerPayments = payments.filter(p =>
    ledgerCustomer && p.customer_id === ledgerCustomer.id &&
    (!ledgerFrom || p.payment_date >= ledgerFrom) &&
    (!ledgerTo || p.payment_date <= ledgerTo)
  );
  const ledgerPurchaseTotal = ledgerBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const ledgerPaidTotal = ledgerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const filteredCustomers = customerStats.filter(customer =>
    `${customer.name} ${customer.mobile || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function setItem(index, key, value) {
    setBillForm(old => ({
      ...old,
      items: old.items.map((item, i) => {
        if (i !== index) return item;

        if (key === "product_id") {
          const product = products.find(p => p.id === value);

          return {
            ...item,
            product_id: value,
            rate: product ? product.default_rate : ""
          };
        }

        return { ...item, [key]: value };
      })
    }));
  }

  const billTotal = billForm.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);

    return sum + (item.unit === "g" ? quantity / 1000 : quantity) * rate;
  }, 0);

  async function addCustomer(e) {
    e.preventDefault();

    if (!supabase) return;

    const { error } = await supabase.from("customers").insert({
      ...customerForm,
      business_name: "",
      gst_number: "",
      user_id: user.id
    });

    if (error) {
      setNotice(error.message);
    } else {
      setCustomerForm(blankCustomer);
      setNotice("Customer saved.");
      loadAll();
    }
  }

  async function addInlineCustomer(e) {
    e.preventDefault();
    if (!inlineCustomerForm.name.trim()) return setNotice("Customer name is required.");
    setInlineCustomerSaving(true);
    const { data, error } = await supabase.from("customers").insert({
      name: inlineCustomerForm.name.trim(),
      mobile: inlineCustomerForm.mobile.trim() || null,
      address: inlineCustomerForm.address.trim() || null,
      business_name: "",
      gst_number: "",
      user_id: user.id
    }).select().single();
    if (error) {
      setNotice("Customer could not be added: " + error.message);
    } else {
      setCustomers(old => [...old, data].sort((a, b) => a.name.localeCompare(b.name)));
      setBillForm(old => ({ ...old, customer_id: data.id }));
      setInlineCustomerForm(blankCustomer);
      setShowInlineCustomer(false);
      setNotice("Customer added and selected in this bill.");
    }
    setInlineCustomerSaving(false);
  }

  async function addInlineProduct(e) {
    e.preventDefault();
    if (!inlineProductForm.name.trim() || inlineProductForm.default_rate === "") {
      return setNotice("Enter product name and default rate.");
    }
    setInlineProductSaving(true);
    const { data, error } = await supabase.from("products").insert({
      name: inlineProductForm.name.trim(),
      default_rate: Number(inlineProductForm.default_rate),
      default_unit: inlineProductForm.default_unit,
      user_id: user.id
    }).select().single();
    if (error) {
      setNotice("Product could not be added: " + error.message);
    } else {
      setProducts(old => [...old, data].sort((a, b) => a.name.localeCompare(b.name)));
      setBillForm(old => ({
        ...old,
        items: old.items.map((item, index) => index === inlineProductRow
          ? { ...item, product_id: data.id, rate: String(data.default_rate), unit: data.default_unit || item.unit }
          : item)
      }));
      setInlineProductForm({ name: "", default_rate: "", default_unit: "kg" });
      setInlineProductRow(null);
      setNotice("Product added and selected in this bill.");
    }
    setInlineProductSaving(false);
  }

  async function addProduct(e) {
    e.preventDefault();

    if (!supabase) return;

    const { error } = await supabase.from("products").insert({
      ...productForm,
      default_rate: Number(productForm.default_rate),
      user_id: user.id
    });

    if (error) {
      setNotice(error.message);
    } else {
      setProductForm({
        name: "",
        default_rate: "",
        default_unit: "kg"
      });

      setNotice("Product saved.");
      loadAll();
    }
  }

  async function addBill(e) {
    e.preventDefault();

    if (!supabase) return;

    if (
      !billForm.customer_id ||
      billForm.items.some(
        item => !item.product_id || !item.quantity || !item.rate
      )
    ) {
      return setNotice(
        "Select a customer and complete every bill item."
      );
    }

    const items = billForm.items.map(item => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit: item.unit,
      rate_per_kg: Number(item.rate),
      line_total:
        (item.unit === "g"
          ? Number(item.quantity) / 1000
          : Number(item.quantity)) * Number(item.rate)
    }));

    const total = items.reduce(
      (sum, item) => sum + item.line_total,
      0
    );

    const { data, error } = await supabase
      .from("bills")
      .insert({
        customer_id: billForm.customer_id,
        bill_date: billForm.bill_date,
        total_amount: total,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return setNotice(error.message);
    }

    const result = await supabase.from("bill_items").insert(
      items.map(item => ({
        ...item,
        bill_id: data.id,
        user_id: user.id
      }))
    );

    if (result.error) {
      setNotice(
        "Bill header saved, but items failed: " + result.error.message
      );
    } else {
      setNotice("Billing record saved.");

      setBillForm({
        customer_id: "",
        bill_date: new Date().toISOString().slice(0, 10),
        items: [
          { product_id: "", quantity: "", unit: "kg", rate: "" }
        ]
      });

      loadAll();
    }
  }

  async function addPayment(e) {
    e.preventDefault();

    if (!supabase) return;

    const { error } = await supabase.from("payments").insert({
      ...paymentForm,
      amount: Number(paymentForm.amount),
      user_id: user.id
    });

    if (error) {
      setNotice(error.message);
    } else {
      setPaymentForm({
        customer_id: "",
        payment_date: new Date().toISOString().slice(0, 10),
        amount: "",
        mode: "Cash",
        note: ""
      });

      setNotice("Payment saved.");
      loadAll();
    }
  }

  const nav = [
    ["overview", "Overview"],
    ["customers", "Customers"],
    ["ledger", "Customer Ledger"],
    ["products", "Products"],
    ["billing", "Add Bill"],
    ["payments", "Add Payment"],
    ["records", "Records"],
    ...(profile.role === "super_admin" ? [["admin", "User Management"]] : [])
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">S</div>
          <div>
            <b>SpiceLedger CRM</b>
            <small>Business records</small>
          </div>
        </div>

        <div className="navlabel">WORKSPACE</div>

        {nav.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "nav active" : "nav"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}

        <div className="sidefoot">
          <span className="dot"></span>
          {profile.role === "super_admin" ? "Super Admin workspace" : profile.role === "admin" ? "Admin workspace" : "Personal workspace"}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">SPICELEDGER WORKSPACE</span>
            <h1>{nav.find(n => n[0] === tab)?.[1]}</h1>
          </div>

          <div className="topright">
            <span className="pill">
              {profile.role === "super_admin" ? "Super Admin" : profile.role === "admin" ? "Admin" : "Private workspace"}
            </span>

            <span>{profile.full_name || user.email}</span>

            <button className="textbtn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice} <b>×</b>
          </div>
        )}

        {loading && <p>Loading records...</p>}

        {tab === "overview" && (
          <>
            <section className="welcome">
              <div>
                <span className="eyebrow light">BUSINESS OVERVIEW</span>
                <h2>Your records, in one place.</h2>
                <p>
                  Track customer billing and payments with your SpiceLedger CRM
                  workspace.
                </p>
              </div>

              <div className="welcomeicon">✦</div>
            </section>

            <section className="stats">
              <Stat title="Total customers" value={customers.length} />
              <Stat title="Total billing" value={money(totalSales)} />
              <Stat title="Payments received" value={money(totalPaid)} />
              <Stat
                title="Outstanding"
                value={money(totalSales - totalPaid)}
              />
            </section>

            <section className="panel">
              <div className="panelhead">
                <div>
                  <h3>Recent billing records</h3>
                  <p>Latest saved bills</p>
                </div>

                <button
                  className="textbtn"
                  onClick={() => setTab("records")}
                >
                  View all →
                </button>
              </div>

              <BillTable
                bills={bills.slice(0, 5)}
                customers={customers}
              />
            </section>
          </>
        )}

        {tab === "customers" && (
          <section className="columns">
            <div className="panel">
              <h3>Add customer</h3>
              <p>Save customer details in your workspace.</p>

              <form onSubmit={addCustomer}>
                <Field
                  label="Customer name"
                  value={customerForm.name}
                  onChange={v =>
                    setCustomerForm({ ...customerForm, name: v })
                  }
                  required
                />

                <Field
                  label="Mobile number"
                  value={customerForm.mobile}
                  onChange={v =>
                    setCustomerForm({ ...customerForm, mobile: v })
                  }
                />

                <Field
                  label="Address"
                  value={customerForm.address}
                  onChange={v =>
                    setCustomerForm({ ...customerForm, address: v })
                  }
                />

                <button className="primary">Save customer</button>
              </form>
            </div>

            <div className="panel">
              <div className="panelhead">
                <div>
                  <h3>Customers</h3>
                  <p>Customer-wise billing and balance</p>
                </div>
              </div>

              <input
                className="search"
                placeholder="Search customer name or mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Billing</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Statement</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map(c => (
                      <tr key={c.id}>
                        <td>
                          <b>{c.name}</b>
                          <small>{c.mobile || c.address || ""}</small>
                        </td>
                        <td>{money(c.sales)}</td>
                        <td>{money(c.paid)}</td>
                        <td><b>{money(c.balance)}</b></td>
                        <td><button type="button" className="small-primary primary" onClick={() => { setLedgerCustomerId(c.id); setTab("ledger"); }}>View Invoice</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "ledger" && (
          <section className="panel invoice-panel">
            <div className="panelhead">
              <div>
                <h3>Customer Purchase Statement</h3>
                <p>Invoice-style purchase and payment history</p>
              </div>
              <button type="button" className="textbtn" onClick={() => window.print()}>Print / Save PDF</button>
            </div>

            <div className="ledger-filters">
              <label>Customer
                <select value={ledgerCustomer?.id || ""} onChange={e => setLedgerCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>From date<input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} /></label>
              <label>To date<input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} /></label>
            </div>

            {!ledgerCustomer ? (
              <div className="empty">Add a customer to view their statement.</div>
            ) : (
              <div className="invoice-sheet">
                <div className="invoice-brand">
                  <div><strong>SPICELEDGER</strong><small>BUSINESS PURCHASE STATEMENT</small></div>
                  <span>STATEMENT</span>
                </div>
                <div className="invoice-customer">
                  <div><small>BILL TO</small><h2>{ledgerCustomer.name}</h2>{ledgerCustomer.mobile && <p>{ledgerCustomer.mobile}</p>}{ledgerCustomer.address && <p>{ledgerCustomer.address}</p>}</div>
                  <div className="invoice-meta"><small>STATEMENT DATE</small><strong>{new Date().toLocaleDateString("en-IN")}</strong><small>PERIOD</small><strong>{ledgerFrom || "All dates"} — {ledgerTo || "Present"}</strong></div>
                </div>

                <h4 className="invoice-section-title">PURCHASE DETAILS</h4>
                <div className="tablewrap">
                  <table className="invoice-table">
                    <thead><tr><th>Date</th><th>Bill No.</th><th>Product</th><th>Qty</th><th>Rate</th><th className="numeric">Amount</th></tr></thead>
                    <tbody>
                      {ledgerBills.flatMap(b => (b.bill_items || []).map((item, index) => {
                        const product = products.find(pr => pr.id === item.product_id);
                        return <tr key={`${b.id}-${index}`}><td>{b.bill_date}</td><td>BILL-{String(b.id).slice(0, 8).toUpperCase()}</td><td>{product?.name || "Product"}</td><td>{item.quantity} {item.unit || ""}</td><td>{money(item.rate_per_kg)}</td><td className="numeric">{money(item.line_total)}</td></tr>;
                      }))}
                      {!ledgerBills.length && <tr><td colSpan="6" className="empty">No purchases found for this customer and date range.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <h4 className="invoice-section-title">PAYMENT HISTORY</h4>
                <div className="tablewrap">
                  <table className="invoice-table">
                    <thead><tr><th>Payment Date</th><th>Payment Mode</th><th>Note</th><th className="numeric">Amount Received</th></tr></thead>
                    <tbody>
                      {ledgerPayments.map(payment => <tr key={payment.id}><td>{payment.payment_date}</td><td>{payment.mode || "—"}</td><td>{payment.note || "—"}</td><td className="numeric">{money(payment.amount)}</td></tr>)}
                      {!ledgerPayments.length && <tr><td colSpan="4" className="empty">No payments found for this customer and date range.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="invoice-totals">
                  <div><span>Total Purchase</span><strong>{money(ledgerPurchaseTotal)}</strong></div>
                  <div><span>Total Payments</span><strong>{money(ledgerPaidTotal)}</strong></div>
                  <div className="invoice-balance"><span>Net Balance for Selected Period</span><strong>{money(ledgerPurchaseTotal - ledgerPaidTotal)}</strong></div>
                </div>
                <div className="invoice-footer">Generated by SpiceLedger CRM · This statement includes purchases and payments in the selected date range.</div>
              </div>
            )}
          </section>
        )}

        {tab === "products" && (
          <section className="columns">
            <div className="panel">
              <h3>Add product</h3>
              <p>Save each product once.</p>

              <form onSubmit={addProduct}>
                <Field
                  label="Product name"
                  value={productForm.name}
                  onChange={v =>
                    setProductForm({ ...productForm, name: v })
                  }
                  required
                />

                <Field
                  label="Default rate (₹ per KG)"
                  type="number"
                  value={productForm.default_rate}
                  onChange={v =>
                    setProductForm({
                      ...productForm,
                      default_rate: v
                    })
                  }
                  required
                />

                <label>
                  Default unit
                  <select
                    value={productForm.default_unit}
                    onChange={e =>
                      setProductForm({
                        ...productForm,
                        default_unit: e.target.value
                      })
                    }
                  >
                    <option value="kg">KG</option>
                    <option value="g">Gram</option>
                  </select>
                </label>

                <button className="primary">Save product</button>
              </form>
            </div>

            <div className="panel">
              <h3>Product master</h3>
              <p>{products.length} saved products</p>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Default rate / KG</th>
                      <th>Unit</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td><b>{p.name}</b></td>
                        <td>{money(p.default_rate)}</td>
                        <td>{p.default_unit.toUpperCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "billing" && (
          <section className="panel narrow">
            <h3>Create billing record</h3>
            <p>
              Gram quantities convert to KG for rate calculation.
            </p>

            <form onSubmit={addBill}>
              <label>
                Customer
                <select
                  required
                  value={billForm.customer_id}
                  onChange={e => setBillForm(old => ({ ...old, customer_id: e.target.value }))}
                >
                  <option value="">Select customer</option>
                  {customers.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button type="button" className="textbtn inline-add-trigger" onClick={() => setShowInlineCustomer(v => !v)}>
                {showInlineCustomer ? "− Close new customer" : "+ Add customer here"}
              </button>
              {showInlineCustomer && (
                <div className="inline-create-box">
                  <b>Quick add customer</b>
                  <div className="inline-create-fields">
                    <Field label="Customer name" value={inlineCustomerForm.name} onChange={v => setInlineCustomerForm(old => ({ ...old, name: v }))} required />
                    <Field label="Mobile number (optional)" value={inlineCustomerForm.mobile} onChange={v => setInlineCustomerForm(old => ({ ...old, mobile: v }))} />
                    <Field label="Address (optional)" value={inlineCustomerForm.address} onChange={v => setInlineCustomerForm(old => ({ ...old, address: v }))} />
                    <button type="button" className="primary" disabled={inlineCustomerSaving} onClick={() => addInlineCustomer({ preventDefault: () => {} })}>{inlineCustomerSaving ? "Saving..." : "Save & select customer"}</button>
                  </div>
                </div>
              )}

              <Field
                label="Bill date"
                type="date"
                value={billForm.bill_date}
                onChange={v =>
                  setBillForm({ ...billForm, bill_date: v })
                }
              />

              <div className="itemhead">
                <b>Bill items</b>

                <button
                  type="button"
                  className="textbtn"
                  onClick={() =>
                    setBillForm({
                      ...billForm,
                      items: [
                        ...billForm.items,
                        {
                          product_id: "",
                          quantity: "",
                          unit: "kg",
                          rate: ""
                        }
                      ]
                    })
                  }
                >
                  + Add product
                </button>
              </div>

              {billForm.items.map((item, i) => (
                <div className="billitem" key={i}>
                  <label>
                    Product
                    <select
                      value={item.product_id}
                      onChange={e => setItem(i, "product_id", e.target.value)}
                    >
                      <option value="">Select product</option>
                      {products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
                    </select>
                    <button type="button" className="textbtn inline-product-trigger" onClick={() => setInlineProductRow(inlineProductRow === i ? null : i)}>
                      {inlineProductRow === i ? "− Close" : "+ Add new product"}
                    </button>
                  </label>

                  <Field
                    label="Quantity"
                    type="number"
                    value={item.quantity}
                    onChange={v => setItem(i, "quantity", v)}
                    required
                  />

                  <label>
                    Unit
                    <select
                      value={item.unit}
                      onChange={e => setItem(i, "unit", e.target.value)}
                    >
                      <option value="kg">KG</option>
                      <option value="g">Gram</option>
                    </select>
                  </label>

                  <Field
                    label="Rate (₹ / KG)"
                    type="number"
                    value={item.rate}
                    onChange={v => setItem(i, "rate", v)}
                    required
                  />

                  <button
                    type="button"
                    className="remove"
                    onClick={() =>
                      setBillForm({
                        ...billForm,
                        items: billForm.items.filter(
                          (_, j) => j !== i
                        )
                      })
                    }
                    disabled={billForm.items.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {inlineProductRow !== null && (
                <div className="inline-create-box">
                  <b>Quick add product</b>
                  <div className="inline-create-fields">
                    <Field label="Product name" value={inlineProductForm.name} onChange={v => setInlineProductForm(old => ({ ...old, name: v }))} required />
                    <Field label="Default rate (₹ / KG)" type="number" value={inlineProductForm.default_rate} onChange={v => setInlineProductForm(old => ({ ...old, default_rate: v }))} required />
                    <label>Default unit<select value={inlineProductForm.default_unit} onChange={e => setInlineProductForm(old => ({ ...old, default_unit: e.target.value }))}><option value="kg">KG</option><option value="g">Gram</option></select></label>
                    <button type="button" className="primary" disabled={inlineProductSaving} onClick={() => addInlineProduct({ preventDefault: () => {} })}>{inlineProductSaving ? "Saving..." : "Save & select product"}</button>
                  </div>
                </div>
              )}

              <div className="totalrow">
                <span>Bill total</span>
                <b>{money(billTotal)}</b>
              </div>

              <button className="primary">
                Save billing record
              </button>
            </form>
          </section>
        )}

        {tab === "payments" && (
          <section className="panel narrow">
            <h3>Record payment</h3>
            <p>Payments are recorded separately from bills.</p>

            <form onSubmit={addPayment}>
              <label>
                Customer
                <select
                  required
                  value={paymentForm.customer_id}
                  onChange={e =>
                    setPaymentForm({
                      ...paymentForm,
                      customer_id: e.target.value
                    })
                  }
                >
                  <option value="">Select customer</option>

                  {customers.map(c => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Payment date"
                type="date"
                value={paymentForm.payment_date}
                onChange={v =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_date: v
                  })
                }
              />

              <Field
                label="Amount received (₹)"
                type="number"
                value={paymentForm.amount}
                onChange={v =>
                  setPaymentForm({ ...paymentForm, amount: v })
                }
                required
              />

              <label>
                Payment mode
                <select
                  value={paymentForm.mode}
                  onChange={e =>
                    setPaymentForm({
                      ...paymentForm,
                      mode: e.target.value
                    })
                  }
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank transfer</option>
                  <option>Cheque</option>
                  <option>Other</option>
                </select>
              </label>

              <Field
                label="Note (optional)"
                value={paymentForm.note}
                onChange={v =>
                  setPaymentForm({ ...paymentForm, note: v })
                }
              />

              <button className="primary">Save payment</button>
            </form>
          </section>
        )}

        {tab === "records" && (
          <section className="panel">
            <div className="panelhead">
              <div>
                <h3>Billing records</h3>
                <p>All saved bills, newest first</p>
              </div>
            </div>

            <BillTable bills={bills} customers={customers} />

            <h3 className="subhead">Recent payments</h3>

            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.payment_date}</td>
                      <td>
                        {customers.find(c => c.id === p.customer_id)?.name || "—"}
                      </td>
                      <td>{p.mode}</td>
                      <td><b>{money(p.amount)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "admin" && profile.role === "super_admin" && (
          <section className="panel">
            <div className="panelhead">
              <div>
                <h3>User management</h3>
                <p>View registered profiles and assign Admin or Normal User access.</p>
              </div>
              <button className="textbtn" type="button" onClick={loadAdminUsers}>
                Refresh users
              </button>
            </div>

            {adminLoading && <p>Loading users...</p>}

            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Change role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map(target => (
                    <tr key={target.id}>
                      <td>
                        <b>{target.full_name || "Unnamed user"}</b>
                        <small>{target.id}</small>
                      </td>
                      <td>
                        <span className={`role-chip role-${target.role}`}>
                          {target.role.replace("_", " ")}
                        </span>
                      </td>
                      <td>{new Date(target.created_at).toLocaleDateString("en-IN")}</td>
                      <td>
                        {target.role === "super_admin" || target.id === user.id ? (
                          <span className="muted">Protected account</span>
                        ) : (
                          <select
                            value={pendingRoles[target.id] || target.role}
                            onChange={e =>
                              setPendingRoles(old => ({
                                ...old,
                                [target.id]: e.target.value
                              }))
                            }
                          >
                            <option value="user">Normal User</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {target.role !== "super_admin" && target.id !== user.id && (
                          <button
                            className="primary small-primary"
                            type="button"
                            disabled={
                              adminLoading ||
                              !pendingRoles[target.id] ||
                              pendingRoles[target.id] === target.role
                            }
                            onClick={() => saveUserRole(target)}
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!adminUsers.length && !adminLoading && (
                    <tr>
                      <td colSpan="5" className="empty">No user profiles found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="admin-note">
              Super Admin accounts cannot be changed from this screen. Account
              activation, deactivation and deletion are intentionally not included;
              those require a protected server-side Auth function.
            </p>
          </section>
        )}

        <footer>SpiceLedger CRM · Private business records</footer>
      </main>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

function BillTable({ bills, customers }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Bill total</th>
          </tr>
        </thead>

        <tbody>
          {bills.map(b => (
            <tr key={b.id}>
              <td>{b.bill_date}</td>
              <td>
                {customers.find(c => c.id === b.customer_id)?.name || "—"}
              </td>
              <td><b>{money(b.total_amount)}</b></td>
            </tr>
          ))}

          {!bills.length && (
            <tr>
              <td colSpan="3" className="empty">
                No billing records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("Supabase connection is missing.");
      setLoading(false);
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", session.user.id)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        setProfile(null);
      } else {
        setProfile(data);
        setError("");
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [session]);

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
    } else {
      setSession(null);
      setProfile(null);
      setError("");
    }
  }

  if (!supabase) {
    return <p>Supabase connection is not configured. Check your .env file.</p>;
  }

  if (loading) {
    return <p>Loading SpiceLedger CRM...</p>;
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile) {
    return (
      <div style={{ padding: 30 }}>
        <p>{error || "Loading your profile..."}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <Workspace
      user={session.user}
      profile={profile}
      onLogout={logout}
    />
  );
}
