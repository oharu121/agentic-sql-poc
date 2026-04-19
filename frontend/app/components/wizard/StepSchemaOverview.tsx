"use client";

import { DataReferencePanel } from "@/app/components/data/DataReferencePanel";

export function StepSchemaOverview() {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold gradient-text mb-2">
          データベーススキーマ
        </h2>
        <p className="text-white/50 text-sm">
          AIエージェントがクエリできるデータです。下記のテーブル、列の型、
          サンプル行をご確認ください。
        </p>
      </div>

      <div className="glass-bubble rounded-2xl p-6">
        <DataReferencePanel />
      </div>
    </div>
  );
}
