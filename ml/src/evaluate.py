import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    roc_auc_score, roc_curve, precision_recall_curve, 
    confusion_matrix, classification_report, average_precision_score
)

def get_precision_at_k(y_true, y_pred_proba, k_percent=0.10):
    """
    Computes precision at top K percent of predicted risk.
    E.g., if we flag the top 10% highest risk athletes, how many actually get injured?
    """
    df = pd.DataFrame({'true': y_true, 'pred': y_pred_proba})
    df = df.sort_values(by='pred', ascending=False)
    
    n_cutoff = int(np.ceil(len(df) * k_percent))
    top_k = df.head(n_cutoff)
    
    precision = top_k['true'].sum() / len(top_k)
    return precision

def print_evaluation_summary(y_true, y_pred_proba, threshold=0.3):
    """
    Prints a detailed evaluation summary including ROC-AUC, Recall, Precision,
    and Precision at the top 10% risk cutoff.
    """
    y_pred = (y_pred_proba >= threshold).astype(int)
    
    auc = roc_auc_score(y_true, y_pred_proba)
    ap = average_precision_score(y_true, y_pred_proba)
    precision_at_10 = get_precision_at_k(y_true, y_pred_proba, k_percent=0.10)
    
    print("=================== MODEL EVALUATION SUMMARY ===================")
    print(f"ROC-AUC Score:                    {auc:.4f}")
    print(f"Average Precision (PR-AUC):       {ap:.4f}")
    print(f"Precision at Top 10% Risk:        {precision_at_10:.2%}")
    print(f"Decision Threshold:               {threshold}")
    print("\nClassification Report:")
    print(classification_report(y_true, y_pred))
    print("================================================================")
    
    return {
        "roc_auc": auc,
        "pr_auc": ap,
        "precision_at_10": precision_at_10,
        "classification_report": classification_report(y_true, y_pred, output_dict=True)
    }

def plot_curves_and_matrix(y_true, y_pred_proba, threshold=0.3, save_dir=None):
    """
    Plots ROC curve, Precision-Recall curve, and confusion matrix in a single figure.
    """
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    y_pred = (y_pred_proba >= threshold).astype(int)
    
    # 1. ROC Curve
    fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
    auc = roc_auc_score(y_true, y_pred_proba)
    axes[0].plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (area = {auc:.2f})')
    axes[0].plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    axes[0].set_xlim([0.0, 1.0])
    axes[0].set_ylim([0.0, 1.05])
    axes[0].set_xlabel('False Positive Rate')
    axes[0].set_ylabel('True Positive Rate')
    axes[0].set_title('Receiver Operating Characteristic (ROC)')
    axes[0].legend(loc="lower right")
    
    # 2. Precision-Recall Curve
    precision, recall, _ = precision_recall_curve(y_true, y_pred_proba)
    ap = average_precision_score(y_true, y_pred_proba)
    axes[1].plot(recall, precision, color='blue', lw=2, label=f'PR curve (AP = {ap:.2f})')
    axes[1].set_xlim([0.0, 1.0])
    axes[1].set_ylim([0.0, 1.05])
    axes[1].set_xlabel('Recall')
    axes[1].set_ylabel('Precision')
    axes[1].set_title('Precision-Recall Curve')
    axes[1].legend(loc="lower left")
    
    # 3. Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[2])
    axes[2].set_xlabel('Predicted')
    axes[2].set_ylabel('Actual')
    axes[2].set_title(f'Confusion Matrix (Threshold = {threshold})')
    axes[2].set_xticklabels(['No Injury', 'Injury'])
    axes[2].set_yticklabels(['No Injury', 'Injury'])
    
    plt.tight_layout()
    
    if save_dir:
        import os
        os.makedirs(save_dir, exist_ok=True)
        plt.savefig(os.path.join(save_dir, 'model_evaluation_plots.png'), dpi=300)
        print(f"Plots saved to {os.path.join(save_dir, 'model_evaluation_plots.png')}")
        
    plt.show()
