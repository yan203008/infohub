"use client";

import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "无法登录");
      }
      window.location.assign("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法登录");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <Link href="/" aria-label="返回首页"><ArrowLeft size={19} /></Link>
      <form className="admin-login-card" onSubmit={submit}>
        <span><KeyRound size={22} /></span>
        <p>INFOHUB ADMIN</p>
        <h1>管理员登录</h1>
        <small>普通读者无需登录。这里仅用于提交内容和管理公共信息流。</small>
        <label>
          管理员密码
          <input
            autoComplete="current-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入管理员密码"
          />
        </label>
        {message && <div className="admin-login-error">{message}</div>}
        <button className="primary-button" disabled={loading || !password}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <KeyRound size={18} />}
          进入管理后台
        </button>
      </form>
    </main>
  );
}
