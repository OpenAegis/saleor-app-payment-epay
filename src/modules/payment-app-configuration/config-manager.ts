import { type MetadataEntry } from "@saleor/app-sdk/settings-manager";
import { type BrandedEncryptedMetadataManager } from "../app-configuration/metadata-manager";
import { type PaymentAppConfig } from "./app-config";
import { type PaymentAppConfigEntry } from "./config-entry";
import { obfuscateConfigEntry } from "./utils";
import { env } from "@/lib/env.mjs";
import { BaseError } from "@/errors";

export const privateMetadataKey = "payment-app-config-private";
export const hiddenMetadataKey = "payment-app-config-hidden";
export const publicMetadataKey = "payment-app-config-public";

export const AppNotConfiguredError = BaseError.subclass("AppNotConfiguredError");

export class ConfigManager {
  private metadataManager: BrandedEncryptedMetadataManager;
  public saleorApiUrl: string;

  constructor(metadataManager: BrandedEncryptedMetadataManager, saleorApiUrl: string) {
    this.metadataManager = metadataManager;
    this.saleorApiUrl = saleorApiUrl;
  }

  async getConfig(): Promise<PaymentAppConfig> {
    const config = await this.metadataManager.get(privateMetadataKey, this.saleorApiUrl);
    if (!config) {
      return { configurations: [], channelToConfigurationId: {} } as PaymentAppConfig;
    }
    
    try {
      return JSON.parse(config) as PaymentAppConfig;
    } catch (e) {
      return { configurations: [], channelToConfigurationId: {} } as PaymentAppConfig;
    }
  }

  async getConfigObfuscated() {
    const { configurations, channelToConfigurationId } = await this.getConfig();

    return {
      configurations: configurations.map((entry) => obfuscateConfigEntry(entry)),
      channelToConfigurationId,
    };
  }

  async getRawConfig(): Promise<MetadataEntry[]> {
    // Since getAll doesn't exist in the MetadataManager interface,
    // we'll return the config as a single metadata entry
    const config = await this.getConfig();
    return [{
      key: privateMetadataKey,
      value: JSON.stringify(config)
    }];
  }

  async getConfigEntry(configurationId: string): Promise<PaymentAppConfigEntry | null | undefined> {
    const config = await this.getConfig();
    return config?.configurations.find((entry) => entry.configurationId === configurationId);
  }

  /** Adds new config entry or updates existing one */
  async setConfigEntry(newConfiguration: PaymentAppConfigEntry) {
    const { configurations } = await this.getConfig();

    const existingEntryIndex = configurations.findIndex(
      (entry) => entry.configurationId === newConfiguration.configurationId,
    );

    if (existingEntryIndex !== -1) {
      const existingEntry = configurations[existingEntryIndex];
      const mergedEntry = {
        ...existingEntry,
        ...newConfiguration,
      };

      const newConfigurations = configurations.slice(0);
      newConfigurations[existingEntryIndex] = mergedEntry;
      return this.setConfig({ configurations: newConfigurations });
    }

    return this.setConfig({
      configurations: [...configurations, newConfiguration],
    });
  }

  async deleteConfigEntry(configurationId: string) {
    const oldConfig = await this.getConfig();
    const newConfigurations = oldConfig.configurations.filter(
      (entry) => entry.configurationId !== configurationId,
    );
    const newMappings = Object.fromEntries(
      Object.entries(oldConfig.channelToConfigurationId).filter(
        ([, configId]) => configId !== configurationId,
      ),
    );
    await this.setConfig(
      { ...oldConfig, configurations: newConfigurations, channelToConfigurationId: newMappings },
      true,
    );
  }

  /** Adds new mappings or updates existing ones */
  async setMapping(channelId: string, configurationId: string) {
    const { channelToConfigurationId } = await this.getConfig();
    return this.setConfig({
      channelToConfigurationId: { ...channelToConfigurationId, [channelId]: configurationId },
    });
  }

  async deleteMapping(channelId: string) {
    const { channelToConfigurationId } = await this.getConfig();
    const newMapping = { ...channelToConfigurationId };
    delete newMapping[channelId];
    return this.setConfig({ channelToConfigurationId: newMapping });
  }

  /** Method that directly updates the config in MetadataManager.
   *  You should probably use setConfigEntry or setMapping instead */
  async setConfig(newConfig: Partial<PaymentAppConfig>, replace = false) {
    if (replace) {
      await this.metadataManager.set({
        key: privateMetadataKey,
        value: JSON.stringify(newConfig),
        domain: this.saleorApiUrl,
      });
    } else {
      const oldConfig = await this.getConfig();
      const mergedConfig = {
        ...oldConfig,
        ...newConfig,
      };
      await this.metadataManager.set({
        key: privateMetadataKey,
        value: JSON.stringify(mergedConfig),
        domain: this.saleorApiUrl,
      });
    }
  }

  async clearConfig() {
    // Since the delete method doesn't seem to support domain directly,
    // we'll set an empty config instead
    await this.metadataManager.set({
      key: privateMetadataKey,
      value: JSON.stringify({ configurations: [], channelToConfigurationId: {} }),
      domain: this.saleorApiUrl,
    });
  }
}

// 添加缺失的导出函数
import { type PaymentAppConfigurator } from "./payment-app-configuration";
import { type PaymentAppFormConfigEntry } from "./config-entry";
import { type ConfigEntryUpdate } from "./input-schemas";
import { randomId } from "@/lib/random-id";

export class EntryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntryNotFoundError";
  }
}

export async function getAllConfigEntriesObfuscated(configurator: PaymentAppConfigurator) {
  const config = await configurator.getConfigObfuscated();
  return config.configurations;
}

export async function getConfigEntryObfuscated(
  configurationId: string,
  configurator: PaymentAppConfigurator,
) {
  const config = await configurator.getConfigObfuscated();
  const entry = config.configurations.find((c) => c.configurationId === configurationId);
  if (!entry) {
    throw new EntryNotFoundError(`Configuration entry with id ${configurationId} not found`);
  }
  return entry;
}

export async function addConfigEntry(
  input: PaymentAppFormConfigEntry,
  configurator: PaymentAppConfigurator,
) {
  const configurationId = randomId();
  
  const newEntry = {
    ...input,
    configurationId,
  };
  
  await configurator.setConfigEntry(newEntry);
  return newEntry;
}

export async function updateConfigEntry(
  input: ConfigEntryUpdate,
  configurator: PaymentAppConfigurator,
) {
  const { configurationId, entry } = input;
  
  // Check if entry exists
  const config = await configurator.getConfig();
  const existingEntry = config.configurations.find((c) => c.configurationId === configurationId);
  if (!existingEntry) {
    throw new EntryNotFoundError(`Configuration entry with id ${configurationId} not found`);
  }
  
  const updatedEntry = {
    ...existingEntry,
    ...entry,
    configurationId, // Ensure ID is preserved
  };
  
  await configurator.setConfigEntry(updatedEntry);
  return updatedEntry;
}

export async function deleteConfigEntry(
  configurationId: string,
  configurator: PaymentAppConfigurator,
) {
  // Check if entry exists
  const config = await configurator.getConfig();
  const existingEntry = config.configurations.find((c) => c.configurationId === configurationId);
  if (!existingEntry) {
    throw new EntryNotFoundError(`Configuration entry with id ${configurationId} not found`);
  }
  
  await configurator.deleteConfigEntry(configurationId);
}
