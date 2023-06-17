function simulateAbsolutePositioning(child, parent, top, left, bottom, right) {
    const parentRect = parent.getBoundingClientRect();
    const parentStyle = getComputedStyle(parent);
    const parentOffsetTop = parentRect.top + window.pageYOffset;
    const parentOffsetLeft = parentRect.left + window.pageXOffset;
    const parentPaddingTop = parseFloat(parentStyle.paddingTop);
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft);
    
    child.style.position = 'absolute';
  
    // Calculate left
    if (left !== undefined && right !== undefined) {
      child.style.left = left;
    } else if (left !== undefined) {
      child.style.left = parseFloat(left) - parentOffsetLeft + parentPaddingLeft + 'px';
    } else if (right !== undefined) {
      child.style.left = parentRect.width - parseFloat(right) + parentOffsetLeft - parentPaddingLeft + 'px';
    }
  
    // Calculate top
    if (top !== undefined && bottom !== undefined) {
      child.style.top = top;
    } else if (top !== undefined) {
      child.style.top = parseFloat(top) - parentOffsetTop + parentPaddingTop + 'px';
    } else if (bottom !== undefined) {
      child.style.top = parentRect.height - parseFloat(bottom) + parentOffsetTop - parentPaddingTop + 'px';
    }

  }

  export default simulateAbsolutePositioning;