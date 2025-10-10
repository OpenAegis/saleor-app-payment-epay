import { describe, it, expect, vi } from "vitest";
import { EpayConfigManager } from "../epay-config-manager";
import { type EpayConfigEntry } from "../epay-config";

// Mock metadata manager
const mockMetadataManager = {
  get: vi.fn(),
  set: vi.fn(),
};

describe("EpayConfigManager", () => {
  it("should create an instance", () => {
    const manager = new EpayConfigManager(
      mockMetadataManager as any,
      "https://example.com/graphql/"
    );
    expect(manager).toBeInstanceOf(EpayConfigManager);
  });

  it("should get config", async () => {
    const manager = new EpayConfigManager(
      mockMetadataManager as any,
      "https://example.com/graphql/"
    );
    
    mockMetadataManager.get.mockResolvedValueOnce(
      JSON.stringify({
        configurations: [],
        channelToConfigurationId: {}
      })
    );
    
    const config = await manager.getConfig();
    expect(config).toEqual({
      configurations: [],
      channelToConfigurationId: {}
    });
  });

  it("should set epay config entry", async () => {
    const manager = new EpayConfigManager(
      mockMetadataManager as any,
      "https://example.com/graphql/"
    );
    
    mockMetadataManager.get.mockResolvedValueOnce(
      JSON.stringify({
        configurations: [],
        channelToConfigurationId: {}
      })
    );
    
    const configEntry: EpayConfigEntry = {
      configurationId: "test-id",
      configurationName: "Test Config",
      apiKey: null,
      apiKeyId: null,
      clientKey: null,
      webhookPassword: null,
      pid: "test-pid",
      key: "test-key",
      apiUrl: "https://epay.example.com",
      enabled: true
    };
    
    await manager.setEpayConfigEntry(configEntry);
    expect(mockMetadataManager.set).toHaveBeenCalled();
  });
});