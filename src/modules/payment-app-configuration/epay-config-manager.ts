import { type BrandedEncryptedMetadataManager } from "../app-configuration/metadata-manager";
import { type PaymentAppConfig } from "./app-config";
import { type EpayConfigEntry, epayConfigEntrySchema } from "./epay-config";
import { obfuscateConfigEntry } from "./utils";

export const privateMetadataKey = "payment-app-config-private";

export class EpayConfigManager {
  private metadataManager: BrandedEncryptedMetadataManager;
  public saleorApiUrl: string;

  constructor(metadataManager: BrandedEncryptedMetadataManager, saleorApiUrl: string) {
    this.metadataManager = metadataManager;
    this.saleorApiUrl = saleorApiUrl;
  }

  async getConfig(): Promise<PaymentAppConfig> {
    const config = await this.metadataManager.get(this.saleorApiUrl, privateMetadataKey);
    if (!config) {
      return { configurations: [], channelToConfigurationId: {} } as PaymentAppConfig;
    }
    
    try {
      return JSON.parse(config) as PaymentAppConfig;
    } catch (e) {
      return { configurations: [], channelToConfigurationId: {} } as PaymentAppConfig;
    }
  }

  async getEpayConfigEntry(configurationId: string): Promise<EpayConfigEntry | null | undefined> {
    const config = await this.getConfig();
    const entry = config?.configurations.find((entry) => entry.configurationId === configurationId);
    if (entry && 'pid' in entry && 'key' in entry && 'apiUrl' in entry) {
      // 验证是否符合彩虹易支付配置模式
      const parsed = epayConfigEntrySchema.safeParse(entry);
      if (parsed.success) {
        return parsed.data;
      }
    }
    return null;
  }

  async setEpayConfigEntry(newConfiguration: EpayConfigEntry) {
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

  async deleteEpayConfigEntry(configurationId: string) {
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

  /** Method that directly updates the config in MetadataManager */
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
}