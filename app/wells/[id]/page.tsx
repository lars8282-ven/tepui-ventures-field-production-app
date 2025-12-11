"use client";

import { db } from "@/lib/instant";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function WellDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  
  const { data: wellData } = db.useQuery({
    wells: {},
  });
  const { data: readingsData } = db.useQuery({
    meterReadings: {},
  });
  const { data: gaugingsData } = db.useQuery({
    tankGauging: {},
  });

  // Extract well from data (handle both array and object formats)
  const wellsRaw = wellData?.wells;
  const allWells = wellsRaw 
    ? Array.isArray(wellsRaw) 
      ? wellsRaw 
      : Object.values(wellsRaw)
    : [];
  const well = allWells.find((w: any) => w.id === id) as any;

  // Extract readings and gaugings
  const readingsRaw = readingsData?.meterReadings;
  const allReadings = readingsRaw
    ? Array.isArray(readingsRaw)
      ? readingsRaw
      : Object.values(readingsRaw)
    : [];
  const readings = allReadings
    .filter((r: any) => r.wellId === id)
    .sort((a: any, b: any) => 
      new Date(b.createdAt || b.timestamp || 0).getTime() - 
      new Date(a.createdAt || a.timestamp || 0).getTime()
    )
    .slice(0, 10);

  const gaugingsRaw = gaugingsData?.tankGauging;
  const allGaugings = gaugingsRaw
    ? Array.isArray(gaugingsRaw)
      ? gaugingsRaw
      : Object.values(gaugingsRaw)
    : [];
  const gaugings = allGaugings
    .filter((g: any) => g.wellId === id)
    .sort((a: any, b: any) => 
      new Date(b.createdAt || b.timestamp || 0).getTime() - 
      new Date(a.createdAt || a.timestamp || 0).getTime()
    )
    .slice(0, 10);

  if (!wellData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading well details...</p>
        </div>
      </div>
    );
  }

  if (!well) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Well not found</p>
          <Link
            href="/wells"
            className="mt-4 inline-block text-tepui-blue hover:text-blue-700 font-semibold"
          >
            ← Back to Wells
          </Link>
        </div>
      </div>
    );
  }

  const metadata = (well.metadata as any) || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/wells"
          className="text-tepui-blue hover:text-blue-700 mb-4 inline-block font-semibold"
        >
          ← Back to Wells
        </Link>
        <h1 className="text-3xl font-bold text-tepui-gray mt-4">
          {well.name}
        </h1>
        <p className="text-lg text-gray-600 mt-1">
          API 14: {well.wellNumber}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 items-center">
          <span
            className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
              well.status === "active"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {well.status}
          </span>
          {well.location || metadata.location ? (
            <span className="text-sm text-gray-600">
              Location: {well.location || metadata.location}
            </span>
          ) : null}
        </div>
      </div>

      {/* Well Information Section */}
      <div className="mb-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-tepui-gray mb-4">
          Well Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metadata.liftType && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Lift Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.liftType}</dd>
            </div>
          )}
          {metadata.county && (
            <div>
              <dt className="text-sm font-medium text-gray-500">County</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.county}</dd>
            </div>
          )}
          {metadata.state && (
            <div>
              <dt className="text-sm font-medium text-gray-500">State</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.state}</dd>
            </div>
          )}
          {metadata.api10 && (
            <div>
              <dt className="text-sm font-medium text-gray-500">API 10</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.api10}</dd>
            </div>
          )}
          {metadata.api14Alt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">API 14 ALT</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.api14Alt}</dd>
            </div>
          )}
          {metadata.tankFactor && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Tank Factor</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.tankFactor}</dd>
            </div>
          )}
          {metadata.wi && (
            <div>
              <dt className="text-sm font-medium text-gray-500">WI</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.wi}</dd>
            </div>
          )}
          {metadata.nri && (
            <div>
              <dt className="text-sm font-medium text-gray-500">NRI</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.nri}</dd>
            </div>
          )}
          {metadata.swd && (
            <div>
              <dt className="text-sm font-medium text-gray-500">SWD</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.swd}</dd>
            </div>
          )}
          {(metadata.sec !== undefined || metadata.twn !== undefined || metadata.rng !== undefined) && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Section/Township/Range</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {[metadata.sec, metadata.twn, metadata.rng].filter(Boolean).join("/")}
              </dd>
            </div>
          )}
          {metadata.leaseDescription && (
            <div className="md:col-span-2 lg:col-span-3">
              <dt className="text-sm font-medium text-gray-500">Lease Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{metadata.leaseDescription}</dd>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Recent Meter Readings
          </h2>
          {readings.length === 0 ? (
            <p className="text-gray-600 text-sm">No readings yet</p>
          ) : (
            <div className="space-y-3">
              {readings.map((reading: any) => (
                <div
                  key={reading.id}
                  className="border-b border-gray-200 pb-3 last:border-0"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {reading.value} {reading.unit}
                      </p>
                      {reading.meterType && (
                        <p className="text-xs text-gray-500">
                          {reading.meterType}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(reading.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href={`/readings?well=${id}`}
            className="mt-4 inline-block text-sm text-tepui-blue hover:text-blue-700 font-semibold"
          >
            View all readings →
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Recent Tank Gaugings
          </h2>
          {gaugings.length === 0 ? (
            <p className="text-gray-600 text-sm">No gaugings yet</p>
          ) : (
            <div className="space-y-3">
              {gaugings.map((gauging: any) => (
                <div
                  key={gauging.id}
                  className="border-b border-gray-200 pb-3 last:border-0"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {gauging.level}%
                      </p>
                      {gauging.tankNumber && (
                        <p className="text-xs text-gray-500">
                          {gauging.tankNumber}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(gauging.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href={`/gauging?well=${id}`}
            className="mt-4 inline-block text-sm text-tepui-blue hover:text-blue-700 font-semibold"
          >
            View all gaugings →
          </Link>
        </div>
      </div>
    </div>
  );
}
