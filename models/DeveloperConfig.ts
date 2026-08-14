import mongoose, { Schema, type Model } from "mongoose";

export type DeveloperSectionDocument = {
  key: "global";
  config: Record<string, unknown>;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DeveloperPublishedRuntimeDocument = {
  key: "published";
  version: number;
  config: Record<string, unknown>;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type DeveloperConfigRevisionDocument = {
  version: number;
  config: Record<string, unknown>;
  publishedAt: Date;
  createdAt: Date;
};

function createSectionSchema() {
  return new Schema<DeveloperSectionDocument>(
    {
      key: { type: String, required: true, unique: true, default: "global" },
      config: { type: Schema.Types.Mixed, required: true, default: {} },
      revision: { type: Number, required: true, default: 1 },
    },
    { timestamps: true },
  );
}

function getSectionModel(collection: string, modelName: string) {
  return (mongoose.models[modelName] as Model<DeveloperSectionDocument>) ||
    mongoose.model<DeveloperSectionDocument>(modelName, createSectionSchema(), collection);
}

export const DeveloperHomeConfig = getSectionModel(
  "developer_home_configs",
  "DeveloperHomeConfig",
);
export const DeveloperMasterPlanConfig = getSectionModel(
  "developer_master_plan_configs",
  "DeveloperMasterPlanConfig",
);
export const DeveloperInteriorTourConfig = getSectionModel(
  "developer_interior_tour_configs",
  "DeveloperInteriorTourConfig",
);
export const DeveloperExteriorTourConfig = getSectionModel(
  "developer_exterior_tour_configs",
  "DeveloperExteriorTourConfig",
);
export const DeveloperAmenitiesConfig = getSectionModel(
  "developer_amenity_configs",
  "DeveloperAmenitiesConfig",
);
export const DeveloperFallbackAssetConfig = getSectionModel(
  "developer_fallback_asset_configs",
  "DeveloperFallbackAssetConfig",
);

const publishedRuntimeSchema = new Schema<DeveloperPublishedRuntimeDocument>(
  {
    key: { type: String, required: true, unique: true, default: "published" },
    version: { type: Number, required: true, default: 1 },
    config: { type: Schema.Types.Mixed, required: true, default: {} },
    publishedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export const DeveloperPublishedRuntimeConfig =
  (mongoose.models.DeveloperPublishedRuntimeConfig as Model<DeveloperPublishedRuntimeDocument>) ||
  mongoose.model<DeveloperPublishedRuntimeDocument>(
    "DeveloperPublishedRuntimeConfig",
    publishedRuntimeSchema,
    "developer_published_runtime_configs",
  );

const revisionSchema = new Schema<DeveloperConfigRevisionDocument>(
  {
    version: { type: Number, required: true, unique: true },
    config: { type: Schema.Types.Mixed, required: true },
    publishedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export const DeveloperConfigRevision =
  (mongoose.models.DeveloperConfigRevision as Model<DeveloperConfigRevisionDocument>) ||
  mongoose.model<DeveloperConfigRevisionDocument>(
    "DeveloperConfigRevision",
    revisionSchema,
    "developer_config_revisions",
  );
