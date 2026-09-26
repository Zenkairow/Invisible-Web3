import { TransactionOrchestrator } from './TransactionOrchestrator';
import { logger } from '../utils/logger';

export class GatewayService {
  private orchestrator: TransactionOrchestrator;

  constructor() {
    this.orchestrator = new TransactionOrchestrator();
  }

  /**
   * Processes an incoming webhook from a Fiat Payment Gateway (e.g. Razorpay, Setu)
   * The payload mimics a standard UPI success webhook structure.
   */
  async handleUpiSuccessWebhook(payload: any) {
    logger.info(`Received Webhook: UPI Success for VPA ${payload.payerVpa}`);
    
    try {
      // Typically we'd verify the webhook signature here using a secret

      const upiId = payload.payerVpa;
      const amount = parseFloat(payload.amount);
      const action = payload.notes?.action || "Wallet Top-up";

      // Trigger the Blockchain Orchestrator
      const txHash = await this.orchestrator.processIncomingPayment(upiId, amount, action);
      
      logger.info(`Webhook Processed Successfully. Mapped to txHash: ${txHash}`);
      return { success: true, txHash };
    } catch (error: any) {
      logger.error(`Webhook Processing Failed: ${error.message}`);
      throw error;
    }
  }
}
